# app/services/robust_routing_engine.py
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import logging
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_

from ..models.support import (
    SupportGroup, SupportTeam, SupportTeamMember, 
    RoutingPolicy, ProficiencyLevel, GroupMemberRole
)

logger = logging.getLogger(__name__)

class RoutingReason(Enum):
    POLICY_MATCH = "policy_match"
    SKILLS_MATCH = "skills_match"
    LOAD_BALANCING = "load_balancing"
    SLA_URGENCY = "sla_urgency"
    ESCALATION = "escalation"
    FALLBACK = "fallback"
    GEOGRAPHIC = "geographic"
    CUSTOMER_PREFERENCE = "customer_preference"

class RoutingPriority(Enum):
    CRITICAL = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4

@dataclass
class TicketContext:
    """Enhanced ticket context for routing decisions"""
    ticket_id: str
    org_id: str
    priority: str
    severity: str
    category: str
    tags: List[str] = field(default_factory=list)
    
    # Enhanced context
    customer_id: Optional[str] = None
    customer_tier: Optional[str] = None  # vip, enterprise, standard
    sla_deadline: Optional[datetime] = None
    estimated_effort: Optional[int] = None  # minutes
    required_skills: List[str] = field(default_factory=list)
    language: str = "en"
    timezone: Optional[str] = None
    previous_agent_id: Optional[str] = None
    escalation_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    # Business context
    business_hours_only: bool = False
    follow_the_sun: bool = False

@dataclass
class AgentCapacity:
    """Agent workload and availability"""
    user_id: str
    team_id: str
    current_tickets: int = 0
    weekly_capacity_minutes: Optional[int] = None
    weekly_used_minutes: int = 0
    avg_resolution_time: Optional[int] = None  # minutes
    is_available: bool = True
    skills: List[str] = field(default_factory=list)
    proficiency_level: ProficiencyLevel = ProficiencyLevel.l1
    timezone: Optional[str] = None
    last_activity: Optional[datetime] = None

@dataclass
class TeamCapacity:
    """Team workload and metrics"""
    team_id: str
    group_id: str
    name: str
    current_load: int = 0  # number of active tickets
    capacity_utilization: float = 0.0  # 0.0 to 1.0
    avg_response_time: Optional[int] = None  # minutes
    avg_resolution_time: Optional[int] = None  # minutes
    sla_breach_rate: float = 0.0  # 0.0 to 1.0
    available_agents: int = 0
    total_agents: int = 0
    skills_coverage: List[str] = field(default_factory=list)
    business_hours_active: bool = True

@dataclass
class RoutingDecision:
    """Final routing decision with reasoning"""
    target_type: str  # "team" or "agent"
    target_id: str
    confidence: float  # 0.0 to 1.0
    reason: RoutingReason
    reasoning: str
    policy_id: Optional[str] = None
    estimated_wait_time: Optional[int] = None  # minutes
    alternatives: List[Dict] = field(default_factory=list)
    
class RobustRoutingEngine:
    """Multi-layered routing engine with load balancing and SLA management"""
    
    def __init__(self, db: Session):
        self.db = db
        self.routing_layers = [
            self._layer_1_critical_escalation,
            self._layer_2_policy_matching,
            self._layer_3_skills_matching,
            self._layer_4_capacity_optimization,
            self._layer_5_sla_optimization,
            self._layer_6_geographic_routing,
            self._layer_7_fallback_routing
        ]
    
    async def route_ticket(self, ticket: TicketContext) -> RoutingDecision:
        """Main routing orchestrator"""
        logger.info(f"Routing ticket {ticket.ticket_id} for org {ticket.org_id}")
        
        # Get current system state
        team_capacities = await self._get_team_capacities(ticket.org_id)
        agent_capacities = await self._get_agent_capacities(ticket.org_id)
        active_policies = await self._get_active_policies(ticket.org_id)
        
        context = {
            'ticket': ticket,
            'teams': team_capacities,
            'agents': agent_capacities,
            'policies': active_policies
        }
        
        # Run through routing layers
        for layer in self.routing_layers:
            try:
                decision = await layer(context)
                if decision and decision.confidence > 0.7:  # High confidence threshold
                    logger.info(f"Routed via {decision.reason.value}: {decision.reasoning}")
                    return decision
            except Exception as e:
                logger.error(f"Error in routing layer {layer.__name__}: {e}")
                continue
        
        # If we get here, return a fallback decision
        return RoutingDecision(
            target_type="group",
            target_id="default_group",
            confidence=0.1,
            reason=RoutingReason.FALLBACK,
            reasoning="All routing layers failed, using system fallback"
        )
    
    async def _layer_1_critical_escalation(self, context: Dict) -> Optional[RoutingDecision]:
        """Handle critical tickets and escalations"""
        ticket = context['ticket']
        teams = context['teams']
        
        # Check for critical conditions
        is_critical = (
            ticket.severity == "sev1" or
            ticket.priority == "critical" or
            ticket.escalation_count >= 2 or
            (ticket.sla_deadline and ticket.sla_deadline <= datetime.utcnow() + timedelta(hours=1))
        )
        
        if not is_critical:
            return None
        
        # Find teams with available senior agents
        senior_teams = [
            team for team in teams.values()
            if team.available_agents > 0 and 
            any(skill in team.skills_coverage for skill in ['senior', 'escalation', 'critical'])
        ]
        
        if senior_teams:
            # Choose team with lowest current load
            best_team = min(senior_teams, key=lambda t: t.capacity_utilization)
            return RoutingDecision(
                target_type="team",
                target_id=best_team.team_id,
                confidence=0.95,
                reason=RoutingReason.ESCALATION,
                reasoning=f"Critical ticket routed to senior team {best_team.name}",
                estimated_wait_time=5
            )
        
        return None
    
    async def _layer_2_policy_matching(self, context: Dict) -> Optional[RoutingDecision]:
        """Traditional policy-based routing with enhanced evaluation"""
        ticket = context['ticket']
        policies = context['policies']
        teams = context['teams']
        
        for policy in policies:
            if not policy.active:
                continue
                
            # Enhanced policy matching
            if self._enhanced_policy_match(ticket, policy):
                target_id = policy.team_id or policy.group_id
                target_type = "team" if policy.team_id else "group"
                
                # Validate target availability
                if target_type == "team" and target_id in teams:
                    team = teams[target_id]
                    if team.available_agents == 0:
                        continue  # Skip if no available agents
                
                confidence = self._calculate_policy_confidence(ticket, policy)
                
                return RoutingDecision(
                    target_type=target_type,
                    target_id=target_id,
                    confidence=confidence,
                    reason=RoutingReason.POLICY_MATCH,
                    reasoning=f"Matched policy: {policy.name}",
                    policy_id=policy.policy_id
                )
        
        return None
    
    async def _layer_3_skills_matching(self, context: Dict) -> Optional[RoutingDecision]:
        """Route based on required skills and agent expertise"""
        ticket = context['ticket']
        teams = context['teams']
        agents = context['agents']
        
        if not ticket.required_skills:
            return None
        
        # Find teams with required skills coverage
        matching_teams = []
        for team in teams.values():
            skill_coverage = len(set(ticket.required_skills) & set(team.skills_coverage))
            if skill_coverage > 0:
                score = skill_coverage / len(ticket.required_skills)
                matching_teams.append((team, score))
        
        if not matching_teams:
            return None
        
        # Sort by skill coverage and availability
        matching_teams.sort(key=lambda x: (x[1], -x[0].capacity_utilization), reverse=True)
        best_team = matching_teams[0][0]
        
        return RoutingDecision(
            target_type="team",
            target_id=best_team.team_id,
            confidence=0.8,
            reason=RoutingReason.SKILLS_MATCH,
            reasoning=f"Skills match: {', '.join(ticket.required_skills)}"
        )
    
    async def _layer_4_capacity_optimization(self, context: Dict) -> Optional[RoutingDecision]:
        """Load balancing and capacity optimization"""
        ticket = context['ticket']
        teams = context['teams']
        
        # Filter available teams
        available_teams = [
            team for team in teams.values()
            if team.available_agents > 0 and team.capacity_utilization < 0.9
        ]
        
        if not available_teams:
            return None
        
        # Score teams based on multiple factors
        def team_score(team: TeamCapacity) -> float:
            score = 0.0
            
            # Capacity utilization (lower is better)
            score += (1.0 - team.capacity_utilization) * 0.4
            
            # Available agents ratio
            if team.total_agents > 0:
                score += (team.available_agents / team.total_agents) * 0.3
            
            # SLA performance (lower breach rate is better)
            score += (1.0 - team.sla_breach_rate) * 0.2
            
            # Response time (faster is better, normalized)
            if team.avg_response_time:
                response_score = max(0, 1.0 - (team.avg_response_time / 60))  # normalize to 1 hour
                score += response_score * 0.1
            
            return score
        
        # Choose best team
        best_team = max(available_teams, key=team_score)
        
        return RoutingDecision(
            target_type="team",
            target_id=best_team.team_id,
            confidence=0.75,
            reason=RoutingReason.LOAD_BALANCING,
            reasoning=f"Optimal capacity team: {best_team.name} ({best_team.capacity_utilization:.1%} utilized)"
        )
    
    async def _layer_5_sla_optimization(self, context: Dict) -> Optional[RoutingDecision]:
        """SLA-aware routing for time-sensitive tickets"""
        ticket = context['ticket']
        teams = context['teams']
        
        if not ticket.sla_deadline:
            return None
        
        time_remaining = ticket.sla_deadline - datetime.utcnow()
        if time_remaining.total_seconds() <= 0:
            return None  # Already breached, handle in escalation layer
        
        # Find teams that can likely meet SLA
        suitable_teams = []
        for team in teams.values():
            if (team.available_agents > 0 and 
                team.avg_response_time and 
                team.avg_response_time < time_remaining.total_seconds() / 60):
                
                suitable_teams.append(team)
        
        if suitable_teams:
            # Choose team with best SLA track record
            best_team = min(suitable_teams, key=lambda t: t.sla_breach_rate)
            
            return RoutingDecision(
                target_type="team",
                target_id=best_team.team_id,
                confidence=0.85,
                reason=RoutingReason.SLA_URGENCY,
                reasoning=f"SLA-optimized routing, {time_remaining} remaining"
            )
        
        return None
    
    async def _layer_6_geographic_routing(self, context: Dict) -> Optional[RoutingDecision]:
        """Geographic and timezone-aware routing"""
        ticket = context['ticket']
        teams = context['teams']
        
        if not ticket.timezone and not ticket.follow_the_sun:
            return None
        
        # This would need integration with team timezone data
        # For now, return None to skip this layer
        return None
    
    async def _layer_7_fallback_routing(self, context: Dict) -> RoutingDecision:
        """Final fallback - always returns a decision"""
        teams = context['teams']
        
        # Find any available team
        available_teams = [t for t in teams.values() if t.available_agents > 0]
        
        if available_teams:
            # Simple round-robin or least loaded
            best_team = min(available_teams, key=lambda t: t.current_load)
            return RoutingDecision(
                target_type="team",
                target_id=best_team.team_id,
                confidence=0.5,
                reason=RoutingReason.FALLBACK,
                reasoning="Fallback to least loaded available team"
            )
        
        # Absolute fallback to default group
        return RoutingDecision(
            target_type="group",
            target_id="default_support",
            confidence=0.3,
            reason=RoutingReason.FALLBACK,
            reasoning="No available teams, routing to default group"
        )
    
    def _enhanced_policy_match(self, ticket: TicketContext, policy) -> bool:
        """Enhanced policy matching with additional context"""
        when = policy.rules.get('when', {})
        
        # Standard rule matching
        if not self._basic_rule_match(ticket, when):
            return False
        
        # Enhanced matching
        customer_tier = when.get('customer_tier')
        if customer_tier and ticket.customer_tier not in customer_tier:
            return False
        
        escalation_level = when.get('escalation_level')
        if escalation_level and ticket.escalation_count < escalation_level:
            return False
        
        return True
    
    def _basic_rule_match(self, ticket: TicketContext, when: Dict) -> bool:
        """Basic rule matching logic"""
        if not when:
            return False
            
        priority_match = not when.get('priority_in') or ticket.priority in when['priority_in']
        severity_match = not when.get('severity_in') or ticket.severity in when['severity_in']
        category_match = not when.get('category_any') or ticket.category in when['category_any']
        
        tag_match = True
        if when.get('tag_any'):
            tag_match = bool(set(ticket.tags) & set(when['tag_any']))
        
        return priority_match and severity_match and category_match and tag_match
    
    def _calculate_policy_confidence(self, ticket: TicketContext, policy) -> float:
        """Calculate confidence score for policy match"""
        base_confidence = 0.8
        
        when = policy.rules.get('when', {})
        
        # Reduce confidence if rules are too broad
        rule_count = sum(1 for key in ['priority_in', 'severity_in', 'category_any', 'tag_any'] 
                        if when.get(key))
        
        if rule_count == 0:
            return 0.3  # Very low confidence for catch-all rules
        elif rule_count == 1:
            return 0.6
        elif rule_count >= 3:
            return 0.9  # High confidence for specific rules
        
        return base_confidence
    
    async def _get_team_capacities(self, org_id: str) -> Dict[str, TeamCapacity]:
        """Get current team capacity and performance metrics"""
        # This would query your database and potentially cache results
        teams = self.db.execute(
            select(SupportTeam).where(
                and_(SupportTeam.org_id == org_id, SupportTeam.active == True)
            )
        ).scalars().all()
        
        capacities = {}
        for team in teams:
            # Calculate real-time metrics (simplified here)
            capacity = TeamCapacity(
                team_id=team.team_id,
                group_id=team.group_id,
                name=team.name,
                current_load=0,  # Would calculate from active tickets
                capacity_utilization=0.0,  # Would calculate from team metrics
                available_agents=len([m for m in team.members if m.active]),
                total_agents=len(team.members),
                business_hours_active=True  # Would check business calendar
            )
            capacities[team.team_id] = capacity
        
        return capacities
    
    async def _get_agent_capacities(self, org_id: str) -> Dict[str, AgentCapacity]:
        """Get current agent availability and workload"""
        # Simplified - would integrate with real-time agent status
        return {}
    
    async def _get_active_policies(self, org_id: str) -> List[Any]:
        """Get active routing policies for organization"""
        return self.db.execute(
            select(RoutingPolicy).where(
                and_(RoutingPolicy.org_id == org_id, RoutingPolicy.active == True)
            ).order_by(RoutingPolicy.created_at)
        ).scalars().all()

# Usage example
async def route_support_ticket(db: Session, ticket_data: Dict) -> RoutingDecision:
    """Main entry point for ticket routing"""
    
    # Create ticket context
    ticket = TicketContext(
        ticket_id=ticket_data['id'],
        org_id=ticket_data['org_id'],
        priority=ticket_data.get('priority', 'normal'),
        severity=ticket_data.get('severity', 'sev3'),
        category=ticket_data.get('category', 'general'),
        tags=ticket_data.get('tags', []),
        customer_tier=ticket_data.get('customer_tier'),
        sla_deadline=ticket_data.get('sla_deadline'),
        required_skills=ticket_data.get('required_skills', []),
        escalation_count=ticket_data.get('escalation_count', 0)
    )
    
    # Route the ticket
    engine = RobustRoutingEngine(db)
    decision = await engine.route_ticket(ticket)
    
    logger.info(f"Routing decision: {decision}")
    return decision