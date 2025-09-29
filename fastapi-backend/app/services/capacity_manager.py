# app/services/capacity_manager.py
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func, text
import json
import logging
from enum import Enum

from ..models.support import (
    SupportTeam, SupportTeamMember, SupportGroup, 
    ProficiencyLevel, GroupMemberRole
)

logger = logging.getLogger(__name__)

class AgentStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    AWAY = "away"
    OFFLINE = "offline"
    IN_MEETING = "in_meeting"

@dataclass
class AgentCapacity:
    """Real-time agent capacity and status"""
    user_id: str
    team_id: str
    status: AgentStatus = AgentStatus.AVAILABLE
    current_tickets: int = 0
    max_concurrent_tickets: int = 5
    weekly_capacity_minutes: Optional[int] = None
    weekly_used_minutes: int = 0
    avg_resolution_time: Optional[int] = None  # minutes
    last_activity: Optional[datetime] = None
    skills: List[str] = field(default_factory=list)
    proficiency_level: ProficiencyLevel = ProficiencyLevel.l1
    role: GroupMemberRole = GroupMemberRole.agent
    
    @property
    def availability_score(self) -> float:
        """Calculate availability score 0-1"""
        if self.status == AgentStatus.OFFLINE:
            return 0.0
        elif self.status == AgentStatus.AWAY:
            return 0.2
        elif self.status == AgentStatus.IN_MEETING:
            return 0.1
        elif self.status == AgentStatus.BUSY:
            if self.current_tickets >= self.max_concurrent_tickets:
                return 0.0
            else:
                return 1.0 - (self.current_tickets / self.max_concurrent_tickets)
        else:  # AVAILABLE
            return 1.0 - (self.current_tickets / self.max_concurrent_tickets)
    
    @property
    def weekly_utilization(self) -> float:
        """Calculate weekly capacity utilization"""
        if not self.weekly_capacity_minutes:
            return 0.0
        return min(1.0, self.weekly_used_minutes / self.weekly_capacity_minutes)

@dataclass
class TeamCapacity:
    """Real-time team capacity metrics"""
    team_id: str
    group_id: str
    name: str
    total_agents: int = 0
    available_agents: int = 0
    busy_agents: int = 0
    offline_agents: int = 0
    current_ticket_load: int = 0
    max_capacity: int = 0
    weekly_capacity_minutes: int = 0
    weekly_used_minutes: int = 0
    avg_response_time: Optional[float] = None  # minutes
    avg_resolution_time: Optional[float] = None  # minutes
    sla_compliance_rate: float = 0.0
    escalation_rate: float = 0.0
    customer_satisfaction: Optional[float] = None
    skills_coverage: List[str] = field(default_factory=list)
    business_hours_active: bool = True
    
    @property
    def capacity_utilization(self) -> float:
        """Current capacity utilization 0-1"""
        if self.max_capacity == 0:
            return 1.0
        return min(1.0, self.current_ticket_load / self.max_capacity)
    
    @property
    def weekly_utilization(self) -> float:
        """Weekly capacity utilization 0-1"""
        if self.weekly_capacity_minutes == 0:
            return 0.0
        return min(1.0, self.weekly_used_minutes / self.weekly_capacity_minutes)
    
    @property
    def availability_score(self) -> float:
        """Overall team availability score 0-1"""
        if self.total_agents == 0:
            return 0.0
        
        # Base score from available agents
        availability_ratio = self.available_agents / self.total_agents
        
        # Adjust for current load
        load_factor = 1.0 - self.capacity_utilization
        
        # Combine factors
        return availability_ratio * load_factor

class CapacityManager:
    """Manages real-time capacity tracking and optimization"""
    
    def __init__(self, db: Session):
        self.db = db
        self._agent_cache = {}  # user_id -> AgentCapacity
        self._team_cache = {}   # team_id -> TeamCapacity
        self._cache_updated = {}  # cache_key -> timestamp
        self._cache_ttl = 300   # 5 minutes
    
    async def get_realtime_metrics(self, org_id: str) -> Dict:
        """Get real-time routing metrics for organization"""
        try:
            # Get team capacities
            team_capacities = await self.get_team_capacities(org_id)
            
            # Calculate aggregate metrics
            total_agents = sum(team.total_agents for team in team_capacities.values())
            available_agents = sum(team.available_agents for team in team_capacities.values())
            total_tickets = sum(team.current_ticket_load for team in team_capacities.values())
            
            # Get queue metrics
            queue_metrics = await self._get_queue_metrics(org_id)
            
            # Recent routing activity
            recent_routes = await self._get_recent_routing_activity(org_id, limit=10)
            
            return {
                "active_tickets": total_tickets,
                "queue_depth": queue_metrics.get("queue_depth", 0),
                "avg_wait_time": queue_metrics.get("avg_wait_time", 0),
                "active_agents": available_agents,
                "total_agents": total_agents,
                "routing_rate": queue_metrics.get("routing_rate", 0),
                "recent_routes": recent_routes,
                "capacity_utilization": queue_metrics.get("overall_utilization", 0),
                "sla_compliance": queue_metrics.get("sla_compliance", 0),
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting realtime metrics: {e}")
            return {"error": str(e)}
    
    async def get_capacity_overview(self, org_id: str) -> Dict:
        """Get comprehensive capacity overview for organization"""
        try:
            team_capacities = await self.get_team_capacities(org_id)
            agent_capacities = await self.get_agent_capacities(org_id)
            
            # Calculate summary statistics
            overview = {
                "teams": len(team_capacities),
                "agents": len(agent_capacities),
                "total_capacity": sum(team.max_capacity for team in team_capacities.values()),
                "current_load": sum(team.current_ticket_load for team in team_capacities.values()),
                "teams_detail": [
                    {
                        "team_id": team.team_id,
                        "name": team.name,
                        "agents": team.total_agents,
                        "available": team.available_agents,
                        "utilization": team.capacity_utilization,
                        "avg_response_time": team.avg_response_time,
                        "sla_compliance": team.sla_compliance_rate
                    }
                    for team in team_capacities.values()
                ],
                "capacity_alerts": await self._generate_capacity_alerts(team_capacities)
            }
            
            return overview
            
        except Exception as e:
            logger.error(f"Error getting capacity overview: {e}")
            return {"error": str(e)}
    
    async def get_team_capacities(self, org_id: str) -> Dict[str, TeamCapacity]:
        """Get current capacity for all teams in organization"""
        cache_key = f"teams_{org_id}"
        
        # Check cache
        if self._is_cache_valid(cache_key):
            return self._team_cache.get(cache_key, {})
        
        try:
            # Query teams
            teams = self.db.execute(
                select(SupportTeam).where(
                    and_(SupportTeam.org_id == org_id, SupportTeam.active == True)
                )
            ).scalars().all()
            
            capacities = {}
            
            for team in teams:
                capacity = await self._calculate_team_capacity(team)
                capacities[team.team_id] = capacity
            
            # Update cache
            self._team_cache[cache_key] = capacities
            self._cache_updated[cache_key] = datetime.utcnow()
            
            return capacities
            
        except Exception as e:
            logger.error(f"Error getting team capacities: {e}")
            return {}
    
    async def get_agent_capacities(self, org_id: str) -> Dict[str, AgentCapacity]:
        """Get current capacity for all agents in organization"""
        cache_key = f"agents_{org_id}"
        
        # Check cache
        if self._is_cache_valid(cache_key):
            return self._agent_cache.get(cache_key, {})
        
        try:
            # Query team members
            query = text("""
                SELECT stm.*, st.team_id, st.name as team_name, st.org_id
                FROM support_team_members stm
                JOIN support_teams st ON stm.team_id = st.team_id
                WHERE st.org_id = :org_id AND stm.active = true
            """)
            
            result = self.db.execute(query, {"org_id": org_id})
            members = result.fetchall()
            
            capacities = {}
            
            for member in members:
                capacity = await self._calculate_agent_capacity(member)
                capacities[member.user_id] = capacity
            
            # Update cache
            self._agent_cache[cache_key] = capacities
            self._cache_updated[cache_key] = datetime.utcnow()
            
            return capacities
            
        except Exception as e:
            logger.error(f"Error getting agent capacities: {e}")
            return {}
    
    async def update_agent_status(self, user_id: str, status: str) -> bool:
        """Update agent availability status"""
        try:
            # Validate status
            if status not in [s.value for s in AgentStatus]:
                raise ValueError(f"Invalid status: {status}")
            
            # Update in database (you'd have an agent_status table)
            # For now, we'll update our cache
            
            # Find agent in cache
            for cache_key, agents in self._agent_cache.items():
                if user_id in agents:
                    agents[user_id].status = AgentStatus(status)
                    agents[user_id].last_activity = datetime.utcnow()
                    break
            
            # Also invalidate team cache since team availability changes
            self._invalidate_team_cache()
            
            logger.info(f"Updated agent {user_id} status to {status}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating agent status: {e}")
            return False
    
    async def update_allocation(self, target_id: str, target_type: str) -> bool:
        """Update allocation after ticket routing"""
        try:
            if target_type == "team":
                # Increment team load
                for cache_key, teams in self._team_cache.items():
                    if target_id in teams:
                        teams[target_id].current_ticket_load += 1
                        break
            
            # Invalidate relevant caches
            self._invalidate_caches()
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating allocation: {e}")
            return False
    
    async def get_team_availability_forecast(
        self, 
        team_id: str, 
        hours_ahead: int = 24
    ) -> Dict:
        """Forecast team availability over next N hours"""
        try:
            # This would integrate with calendar data and historical patterns
            # For now, return a simplified forecast
            
            current_capacity = await self._get_current_team_capacity(team_id)
            
            # Generate hourly forecast
            forecast = []
            base_time = datetime.utcnow()
            
            for hour in range(hours_ahead):
                forecast_time = base_time + timedelta(hours=hour)
                
                # Simple model - could be enhanced with ML
                availability_factor = self._calculate_time_availability_factor(forecast_time)
                
                forecast.append({
                    "hour": forecast_time.isoformat(),
                    "predicted_availability": current_capacity.availability_score * availability_factor,
                    "predicted_load": current_capacity.current_ticket_load,
                    "confidence": 0.7  # Could calculate based on historical accuracy
                })
            
            return {
                "team_id": team_id,
                "forecast_hours": hours_ahead,
                "forecast": forecast
            }
            
        except Exception as e:
            logger.error(f"Error generating availability forecast: {e}")
            return {"error": str(e)}
    
    # ==================== PRIVATE METHODS ====================
    
    async def _calculate_team_capacity(self, team: SupportTeam) -> TeamCapacity:
        """Calculate real-time capacity for a team"""
        # Get team members
        members = self.db.execute(
            select(SupportTeamMember).where(
                and_(
                    SupportTeamMember.team_id == team.team_id,
                    SupportTeamMember.active == True
                )
            )
        ).scalars().all()
        
        # Calculate aggregate metrics
        total_agents = len(members)
        available_agents = 0
        busy_agents = 0
        offline_agents = 0
        max_capacity = 0
        weekly_capacity = 0
        
        for member in members:
            # Get agent status (would query from agent_status table)
            agent_status = await self._get_agent_status(member.user_id)
            
            if agent_status == AgentStatus.AVAILABLE:
                available_agents += 1
            elif agent_status in [AgentStatus.BUSY, AgentStatus.IN_MEETING]:
                busy_agents += 1
            else:
                offline_agents += 1
            
            # Add to capacity calculations
            max_capacity += 5  # Default max concurrent tickets per agent
            weekly_capacity += member.weekly_capacity_minutes or 2400  # 40 hours default
        
        # Get current ticket load
        current_load = await self._get_team_current_load(team.team_id)
        
        # Get performance metrics
        perf_metrics = await self._get_team_performance_metrics(team.team_id)
        
        # Get skills coverage
        skills = await self._get_team_skills_coverage(team.team_id)
        
        return TeamCapacity(
            team_id=team.team_id,
            group_id=team.group_id,
            name=team.name,
            total_agents=total_agents,
            available_agents=available_agents,
            busy_agents=busy_agents,
            offline_agents=offline_agents,
            current_ticket_load=current_load,
            max_capacity=max_capacity,
            weekly_capacity_minutes=weekly_capacity,
            weekly_used_minutes=perf_metrics.get("weekly_used", 0),
            avg_response_time=perf_metrics.get("avg_response_time"),
            avg_resolution_time=perf_metrics.get("avg_resolution_time"),
            sla_compliance_rate=perf_metrics.get("sla_compliance", 0.0),
            escalation_rate=perf_metrics.get("escalation_rate", 0.0),
            customer_satisfaction=perf_metrics.get("customer_satisfaction"),
            skills_coverage=skills,
            business_hours_active=await self._is_business_hours(team.team_id)
        )
    
    async def _calculate_agent_capacity(self, member_row) -> AgentCapacity:
        """Calculate real-time capacity for an agent"""
        # Get agent status
        status = await self._get_agent_status(member_row.user_id)
        
        # Get current ticket count
        current_tickets = await self._get_agent_current_tickets(member_row.user_id)
        
        # Get performance metrics
        perf_metrics = await self._get_agent_performance_metrics(member_row.user_id)
        
        # Get skills
        skills = await self._get_agent_skills(member_row.user_id)
        
        return AgentCapacity(
            user_id=member_row.user_id,
            team_id=member_row.team_id,
            status=status,
            current_tickets=current_tickets,
            max_concurrent_tickets=5,  # Could be configurable per agent
            weekly_capacity_minutes=member_row.weekly_capacity_minutes,
            weekly_used_minutes=perf_metrics.get("weekly_used", 0),
            avg_resolution_time=perf_metrics.get("avg_resolution_time"),
            last_activity=perf_metrics.get("last_activity"),
            skills=skills,
            proficiency_level=member_row.proficiency,
            role=member_row.role
        )
    
    async def _get_agent_status(self, user_id: str) -> AgentStatus:
        """Get current agent status"""
        # In production, this would query agent_status table
        # For now, return a default status
        return AgentStatus.AVAILABLE
    
    async def _get_team_current_load(self, team_id: str) -> int:
        """Get current ticket load for team"""
        # Query active tickets assigned to team
        # For now, return a mock value
        return 5
    
    async def _get_team_performance_metrics(self, team_id: str) -> Dict:
        """Get team performance metrics"""
        # Query performance metrics from tickets/analytics
        return {
            "weekly_used": 1200,
            "avg_response_time": 15.5,
            "avg_resolution_time": 85.2,
            "sla_compliance": 0.87,
            "escalation_rate": 0.12,
            "customer_satisfaction": 4.2
        }
    
    async def _get_team_skills_coverage(self, team_id: str) -> List[str]:
        """Get skills covered by team"""
        # Query skills from team members
        return ["technical", "billing", "account_management"]
    
    async def _is_business_hours(self, team_id: str) -> bool:
        """Check if team is in business hours"""
        # Would integrate with business calendar
        return True
    
    async def _get_agent_current_tickets(self, user_id: str) -> int:
        """Get current ticket count for agent"""
        # Query active tickets assigned to agent
        return 2
    
    async def _get_agent_performance_metrics(self, user_id: str) -> Dict:
        """Get agent performance metrics"""
        return {
            "weekly_used": 800,
            "avg_resolution_time": 75.0,
            "last_activity": datetime.utcnow() - timedelta(minutes=15)
        }
    
    async def _get_agent_skills(self, user_id: str) -> List[str]:
        """Get agent skills"""
        return ["technical", "customer_service"]
    
    async def _get_current_team_capacity(self, team_id: str) -> TeamCapacity:
        """Get current capacity for specific team"""
        # Would query or calculate current capacity
        return TeamCapacity(
            team_id=team_id,
            group_id="group1",
            name="Team 1",
            availability_score=0.8
        )
    
    def _calculate_time_availability_factor(self, forecast_time: datetime) -> float:
        """Calculate availability factor for given time"""
        hour = forecast_time.hour
        weekday = forecast_time.weekday()
        
        # Business hours factor
        if 9 <= hour <= 17 and weekday < 5:  # 9 AM - 5 PM, weekdays
            return 1.0
        elif 17 < hour <= 21 or weekday == 5:  # Evening or Saturday
            return 0.7
        else:  # Night or Sunday
            return 0.3
    
    async def _get_queue_metrics(self, org_id: str) -> Dict:
        """Get queue-related metrics"""
        # Would query ticket queues and routing history
        return {
            "queue_depth": 15,
            "avg_wait_time": 8,
            "routing_rate": 12,
            "overall_utilization": 0.68,
            "sla_compliance": 0.89
        }
    
    async def _get_recent_routing_activity(self, org_id: str, limit: int = 10) -> List[Dict]:
        """Get recent routing decisions"""
        # Would query routing_decisions table
        return [
            {
                "ticket_id": "T-001",
                "target_name": "Technical Support",
                "reasoning": "Skills match for technical issue",
                "confidence": 0.89,
                "timestamp": (datetime.utcnow() - timedelta(minutes=2)).isoformat()
            },
            {
                "ticket_id": "T-002", 
                "target_name": "Billing Team",
                "reasoning": "Category-based routing",
                "confidence": 0.95,
                "timestamp": (datetime.utcnow() - timedelta(minutes=5)).isoformat()
            }
        ]
    
    async def _generate_capacity_alerts(self, team_capacities: Dict[str, TeamCapacity]) -> List[Dict]:
        """Generate capacity alerts"""
        alerts = []
        
        for team in team_capacities.values():
            # High utilization alert
            if team.capacity_utilization > 0.9:
                alerts.append({
                    "type": "high_utilization",
                    "team_id": team.team_id,
                    "team_name": team.name,
                    "message": f"Team {team.name} is at {team.capacity_utilization:.1%} capacity",
                    "severity": "warning"
                })
            
            # No available agents alert
            if team.available_agents == 0 and team.total_agents > 0:
                alerts.append({
                    "type": "no_availability",
                    "team_id": team.team_id,
                    "team_name": team.name,
                    "message": f"No agents available in {team.name}",
                    "severity": "critical"
                })
            
            # Low SLA compliance alert
            if team.sla_compliance_rate < 0.8:
                alerts.append({
                    "type": "sla_risk",
                    "team_id": team.team_id,
                    "team_name": team.name,
                    "message": f"SLA compliance below 80% for {team.name}",
                    "severity": "warning"
                })
        
        return alerts
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cache is still valid"""
        if cache_key not in self._cache_updated:
            return False
        
        age = datetime.utcnow() - self._cache_updated[cache_key]
        return age.total_seconds() < self._cache_ttl
    
    def _invalidate_caches(self):
        """Invalidate all caches"""
        self._cache_updated.clear()
    
    def _invalidate_team_cache(self):
        """Invalidate team capacity caches"""
        keys_to_remove = [k for k in self._cache_updated.keys() if k.startswith("teams_")]
        for key in keys_to_remove:
            del self._cache_updated[key]