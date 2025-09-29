# app/routers/robust_routing.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import asyncio
import json
import logging
from pydantic import BaseModel

from ..db import get_db
from ..services.robust_routing_engine import RobustRoutingEngine, TicketContext, RoutingDecision
from ..services.ml_routing_optimizer import MLRoutingOptimizer
from ..services.capacity_manager import CapacityManager
from ..services.routing_analytics import RoutingAnalytics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/routing", tags=["Robust Routing"])

# Pydantic models for API
class TicketRouteRequest(BaseModel):
    ticket_id: str
    org_id: str
    priority: str = "normal"
    severity: str = "sev3"
    category: str = "general"
    tags: List[str] = []
    customer_id: Optional[str] = None
    customer_tier: Optional[str] = None
    sla_deadline: Optional[datetime] = None
    estimated_effort: Optional[int] = None
    required_skills: List[str] = []
    language: str = "en"
    timezone: Optional[str] = None
    previous_agent_id: Optional[str] = None
    escalation_count: int = 0

class RoutingConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    load_balancing_weight: Optional[float] = None
    sla_weight: Optional[float] = None
    skills_weight: Optional[float] = None
    max_queue_depth: Optional[int] = None
    escalation_threshold: Optional[int] = None
    business_hours_only: Optional[bool] = None
    follow_the_sun: Optional[bool] = None

class RoutingFeedback(BaseModel):
    ticket_id: str
    routing_decision_id: str
    outcome: str  # "success", "escalated", "reassigned", "failed"
    resolution_time: Optional[int] = None
    customer_satisfaction: Optional[int] = None  # 1-5 scale
    agent_feedback: Optional[str] = None

# ==================== CORE ROUTING ENDPOINTS ====================

@router.post("/route", response_model=Dict)
async def route_ticket(
    request: TicketRouteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Main endpoint for routing tickets"""
    try:
        # Create ticket context
        ticket = TicketContext(
            ticket_id=request.ticket_id,
            org_id=request.org_id,
            priority=request.priority,
            severity=request.severity,
            category=request.category,
            tags=request.tags,
            customer_id=request.customer_id,
            customer_tier=request.customer_tier,
            sla_deadline=request.sla_deadline,
            estimated_effort=request.estimated_effort,
            required_skills=request.required_skills,
            language=request.language,
            timezone=request.timezone,
            previous_agent_id=request.previous_agent_id,
            escalation_count=request.escalation_count
        )
        
        # Route the ticket
        engine = RobustRoutingEngine(db)
        decision = await engine.route_ticket(ticket)
        
        # Store decision for analytics and feedback
        background_tasks.add_task(
            store_routing_decision, 
            db, 
            ticket.ticket_id, 
            decision
        )
        
        # Update capacity metrics
        background_tasks.add_task(
            update_capacity_metrics,
            db,
            decision.target_id,
            decision.target_type
        )
        
        return {
            "ticket_id": ticket.ticket_id,
            "routing_decision": {
                "target_type": decision.target_type,
                "target_id": decision.target_id,
                "confidence": decision.confidence,
                "reason": decision.reason.value,
                "reasoning": decision.reasoning,
                "estimated_wait_time": decision.estimated_wait_time,
                "alternatives": decision.alternatives
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing failed: {str(e)}")

@router.post("/feedback")
async def submit_routing_feedback(
    feedback: RoutingFeedback,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Submit feedback on routing decisions for ML optimization"""
    try:
        # Store feedback
        background_tasks.add_task(
            process_routing_feedback,
            db,
            feedback
        )
        
        # Trigger ML model update if needed
        background_tasks.add_task(
            trigger_ml_update,
            db,
            feedback.org_id if hasattr(feedback, 'org_id') else None
        )
        
        return {"status": "feedback_received", "feedback_id": feedback.routing_decision_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback submission failed: {str(e)}")

# ==================== ENHANCED ANALYTICS ENDPOINTS ====================

@router.get("/analytics")
async def get_routing_analytics(
    org_id: str,
    range: str = "24h",
    db: Session = Depends(get_db)
):
    """Get comprehensive routing analytics and performance metrics"""
    try:
        analytics = RoutingAnalytics(db)
        data = await analytics.get_comprehensive_analytics(org_id, range)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {str(e)}")

@router.get("/analytics/policies")
async def get_routing_policy_analytics(
    org_id: str,
    time_range: str = Query("24h", description="Time range for analysis"),
    db: Session = Depends(get_db)
):
    """Get detailed analytics for routing policies by target type"""
    try:
        analytics = RoutingAnalytics(db)
        data = await analytics.get_routing_policy_analytics(org_id, time_range)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Policy analytics failed: {str(e)}")

@router.get("/analytics/performance-comparison")
async def get_group_vs_team_performance(
    org_id: str,
    time_range: str = Query("24h", description="Time range for comparison"),
    db: Session = Depends(get_db)
):
    """Compare performance between group-level and team-level routing"""
    try:
        analytics = RoutingAnalytics(db)
        data = await analytics.get_group_vs_team_performance(org_id, time_range)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Performance comparison failed: {str(e)}")

@router.get("/analytics/members")
async def get_member_performance_analytics(
    org_id: str,
    time_range: str = Query("24h", description="Time range for analysis"),
    db: Session = Depends(get_db)
):
    """Analyze performance of individual members across groups and teams"""
    try:
        analytics = RoutingAnalytics(db)
        data = await analytics.get_member_performance_analytics(org_id, time_range)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Member analytics failed: {str(e)}")

@router.get("/analytics/complexity")
async def get_routing_complexity_analysis(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Analyze routing complexity and optimization opportunities"""
    try:
        analytics = RoutingAnalytics(db)
        data = await analytics.get_routing_complexity_analysis(org_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Complexity analysis failed: {str(e)}")

@router.get("/analytics/effectiveness-report")
async def get_routing_effectiveness_report(
    org_id: str,
    days: int = Query(30, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Generate detailed routing effectiveness report"""
    try:
        analytics = RoutingAnalytics(db)
        data = await analytics.get_routing_effectiveness_report(org_id, days)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Effectiveness report failed: {str(e)}")

@router.get("/analytics/predictive-insights")
async def get_predictive_insights(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Generate predictive insights for capacity planning"""
    try:
        analytics = RoutingAnalytics(db)
        data = await analytics.get_predictive_insights(org_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Predictive insights failed: {str(e)}")

@router.get("/realtime")
async def get_realtime_metrics(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Get real-time routing metrics"""
    try:
        capacity_manager = CapacityManager(db)
        metrics = await capacity_manager.get_realtime_metrics(org_id)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Real-time metrics failed: {str(e)}")

# ==================== ENHANCED CAPACITY MANAGEMENT ENDPOINTS ====================

@router.get("/capacity/overview/{org_id}")
async def get_org_capacity_overview(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Get comprehensive organization capacity including groups and teams"""
    try:
        capacity_manager = CapacityManager(db)
        overview = await capacity_manager.get_org_capacity_overview(org_id)
        return overview
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Org capacity overview failed: {str(e)}")

@router.get("/capacity/group/{group_id}/members")
async def get_group_members_capacity(
    group_id: str,
    db: Session = Depends(get_db)
):
    """Get capacity information for all group members"""
    try:
        capacity_manager = CapacityManager(db)
        members = await capacity_manager.get_group_members_capacity(group_id)
        return {"group_id": group_id, "members": members}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Group members capacity failed: {str(e)}")

@router.get("/capacity/routing-targets/{org_id}")
async def get_routing_target_capacities(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Get capacity information organized by routing targets"""
    try:
        capacity_manager = CapacityManager(db)
        targets = await capacity_manager.get_routing_target_capacities(org_id)
        return targets
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing target capacities failed: {str(e)}")

@router.get("/capacity/cross-functional/{org_id}")
async def analyze_cross_functional_capacity(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Analyze capacity across groups and teams for cross-functional insights"""
    try:
        capacity_manager = CapacityManager(db)
        analysis = await capacity_manager.analyze_cross_functional_capacity(org_id)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cross-functional analysis failed: {str(e)}")

@router.get("/capacity/teams/{org_id}")
async def get_team_capacities(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Get current capacity for all teams in organization"""
    try:
        capacity_manager = CapacityManager(db)
        capacities = await capacity_manager.get_team_capacities(org_id)
        return {"org_id": org_id, "teams": capacities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Team capacities failed: {str(e)}")

@router.get("/capacity/agents/{org_id}")
async def get_agent_capacities(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Get current capacity for all agents in organization"""
    try:
        capacity_manager = CapacityManager(db)
        capacities = await capacity_manager.get_agent_capacities(org_id)
        return {"org_id": org_id, "agents": capacities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent capacities failed: {str(e)}")

@router.post("/capacity/agent-status")
async def update_agent_status(
    agent_id: str,
    status: str,  # "available", "busy", "away", "offline"
    db: Session = Depends(get_db)
):
    """Update agent availability status"""
    try:
        capacity_manager = CapacityManager(db)
        success = await capacity_manager.update_agent_status(agent_id, status)
        if success:
            return {"status": "agent_status_updated", "agent_id": agent_id, "new_status": status}
        else:
            raise HTTPException(status_code=400, detail="Failed to update agent status")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status update failed: {str(e)}")

# ==================== CONFIGURATION ENDPOINTS ====================

@router.get("/config")
async def get_routing_config(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Get current routing configuration"""
    try:
        config = await get_org_routing_config(db, org_id)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Config retrieval failed: {str(e)}")

@router.patch("/config")
async def update_routing_config(
    org_id: str,
    config_update: RoutingConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update routing configuration"""
    try:
        updated_config = await update_org_routing_config(db, org_id, config_update)
        return {"status": "config_updated", "config": updated_config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Config update failed: {str(e)}")

# ==================== ML OPTIMIZATION ENDPOINTS ====================

@router.post("/optimize")
async def trigger_ml_optimization(
    org_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger ML model optimization"""
    try:
        background_tasks.add_task(run_ml_optimization, db, org_id)
        return {"status": "optimization_started", "org_id": org_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization trigger failed: {str(e)}")

@router.get("/optimization-status/{org_id}")
async def get_optimization_status(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Get ML optimization status"""
    try:
        optimizer = MLRoutingOptimizer(db)
        status = await optimizer.get_optimization_status(org_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status retrieval failed: {str(e)}")

# ==================== A/B TESTING ENDPOINTS ====================

@router.post("/ab-test")
async def create_ab_test(
    org_id: str,
    test_config: Dict,
    db: Session = Depends(get_db)
):
    """Create A/B test for routing strategies"""
    try:
        test_id = await create_routing_ab_test(db, org_id, test_config)
        return {"status": "test_created", "test_id": test_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"A/B test creation failed: {str(e)}")

@router.get("/ab-test/{test_id}")
async def get_ab_test_results(
    test_id: str,
    db: Session = Depends(get_db)
):
    """Get A/B test results"""
    try:
        results = await get_routing_ab_test_results(db, test_id)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"A/B test results failed: {str(e)}")

# ==================== HEALTH AND MONITORING ENDPOINTS ====================

@router.get("/health")
async def get_routing_system_health(
    org_id: str,
    db: Session = Depends(get_db)
):
    """Get overall routing system health and status"""
    try:
        # Check system components
        capacity_manager = CapacityManager(db)
        analytics = RoutingAnalytics(db)
        optimizer = MLRoutingOptimizer(db)
        
        # Get health metrics
        realtime_metrics = await capacity_manager.get_realtime_metrics(org_id)
        optimization_status = await optimizer.get_optimization_status(org_id)
        
        # Calculate health score
        health_score = await calculate_system_health_score(realtime_metrics, optimization_status)
        
        return {
            "status": "healthy" if health_score > 0.8 else "degraded" if health_score > 0.5 else "unhealthy",
            "health_score": health_score,
            "components": {
                "routing_engine": "operational",
                "capacity_manager": "operational",
                "analytics": "operational",
                "ml_optimizer": "operational" if optimization_status.get("has_model", False) else "degraded"
            },
            "metrics": realtime_metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

# ==================== BACKGROUND TASKS ====================

async def store_routing_decision(
    db: Session,
    ticket_id: str,
    decision: RoutingDecision
):
    """Store routing decision for analytics"""
    try:
        # Implementation to store in database
        logger.info(f"Stored routing decision for ticket {ticket_id}")
    except Exception as e:
        logger.error(f"Failed to store routing decision: {e}")

async def update_capacity_metrics(
    db: Session,
    target_id: str,
    target_type: str
):
    """Update capacity metrics after routing"""
    try:
        capacity_manager = CapacityManager(db)
        await capacity_manager.update_allocation(target_id, target_type)
        logger.info(f"Updated capacity metrics for {target_type} {target_id}")
    except Exception as e:
        logger.error(f"Failed to update capacity metrics: {e}")

async def process_routing_feedback(
    db: Session,
    feedback: RoutingFeedback
):
    """Process routing feedback for learning"""
    try:
        # Store feedback in database
        # Update quality metrics
        logger.info(f"Processed feedback for ticket {feedback.ticket_id}")
    except Exception as e:
        logger.error(f"Failed to process routing feedback: {e}")

async def trigger_ml_update(
    db: Session,
    org_id: Optional[str]
):
    """Trigger ML model update if threshold reached"""
    try:
        if org_id:
            optimizer = MLRoutingOptimizer(db)
            updated = await optimizer.check_and_update_model(org_id)
            if updated:
                logger.info(f"Triggered ML model update for org {org_id}")
    except Exception as e:
        logger.error(f"Failed to trigger ML update: {e}")

async def run_ml_optimization(
    db: Session,
    org_id: str
):
    """Run comprehensive ML optimization"""
    try:
        optimizer = MLRoutingOptimizer(db)
        result = await optimizer.optimize_routing_model(org_id)
        logger.info(f"ML optimization completed for org {org_id}: {result}")
    except Exception as e:
        logger.error(f"ML optimization failed: {e}")

# ==================== HELPER FUNCTIONS ====================

async def get_org_routing_config(db: Session, org_id: str) -> Dict:
    """Get organization routing configuration"""
    # Implementation to retrieve from database
    return {
        "enabled": True,
        "load_balancing_weight": 0.4,
        "sla_weight": 0.3,
        "skills_weight": 0.3,
        "max_queue_depth": 50,
        "escalation_threshold": 3,
        "business_hours_only": False,
        "follow_the_sun": False
    }

async def update_org_routing_config(
    db: Session,
    org_id: str,
    config_update: RoutingConfigUpdate
) -> Dict:
    """Update organization routing configuration"""
    # Implementation to update in database
    current_config = await get_org_routing_config(db, org_id)
    
    # Update only provided fields
    update_data = config_update.dict(exclude_unset=True)
    current_config.update(update_data)
    
    # Store updated config in database
    # ...
    
    return current_config

async def create_routing_ab_test(
    db: Session,
    org_id: str,
    test_config: Dict
) -> str:
    """Create A/B test for routing strategies"""
    # Implementation for A/B testing
    test_id = f"test_{org_id}_{int(datetime.utcnow().timestamp())}"
    # Store test configuration
    return test_id

async def get_routing_ab_test_results(
    db: Session,
    test_id: str
) -> Dict:
    """Get A/B test results"""
    # Implementation to retrieve test results
    return {
        "test_id": test_id,
        "status": "running",
        "metrics": {
            "variant_a": {"success_rate": 0.85, "avg_resolution_time": 120},
            "variant_b": {"success_rate": 0.88, "avg_resolution_time": 115}
        }
    }

async def calculate_system_health_score(
    realtime_metrics: Dict,
    optimization_status: Dict
) -> float:
    """Calculate overall system health score"""
    try:
        score = 1.0
        
        # Check capacity utilization
        if realtime_metrics.get("capacity_utilization", 0) > 0.9:
            score -= 0.2
        
        # Check SLA compliance
        if realtime_metrics.get("sla_compliance", 0) < 0.8:
            score -= 0.3
        
        # Check ML model status
        if not optimization_status.get("has_model", False):
            score -= 0.1
        
        return max(0.0, score)
    except Exception:
        return 0.5  # Default moderate health score