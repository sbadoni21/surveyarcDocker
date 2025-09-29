# app/services/ml_routing_optimizer.py
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
import pickle
import logging
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

# For production, you'd use scikit-learn, xgboost, or similar
# This is a simplified implementation showing the concept
logger = logging.getLogger(__name__)

@dataclass
class RoutingFeatures:
    """Feature vector for ML model"""
    # Ticket features
    priority_encoded: int
    severity_encoded: int
    category_encoded: int
    customer_tier_encoded: int
    estimated_effort: float
    escalation_count: int
    hour_of_day: int
    day_of_week: int
    
    # Historical features
    previous_agent_success_rate: float
    team_avg_resolution_time: float
    team_current_load: float
    team_capacity_utilization: float
    team_sla_performance: float
    agent_skill_match_score: float
    
    # Context features
    queue_depth: int
    time_to_sla_deadline: float
    business_hours: int
    
    def to_array(self) -> np.ndarray:
        """Convert to numpy array for ML model"""
        return np.array([
            self.priority_encoded,
            self.severity_encoded,
            self.category_encoded,
            self.customer_tier_encoded,
            self.estimated_effort,
            self.escalation_count,
            self.hour_of_day,
            self.day_of_week,
            self.previous_agent_success_rate,
            self.team_avg_resolution_time,
            self.team_current_load,
            self.team_capacity_utilization,
            self.team_sla_performance,
            self.agent_skill_match_score,
            self.queue_depth,
            self.time_to_sla_deadline,
            self.business_hours
        ])

@dataclass
class RoutingOutcome:
    """Outcome data for training"""
    success_score: float  # 0-1 based on resolution time, customer satisfaction, etc.
    resolution_time_minutes: int
    escalated: bool
    customer_satisfaction: Optional[int]  # 1-5 scale
    sla_met: bool

class MLRoutingOptimizer:
    """Machine Learning service for optimizing routing decisions"""
    
    def __init__(self, db: Session):
        self.db = db
        self.models = {}  # org_id -> model
        self.feature_encoders = {}  # org_id -> encoders
        self.model_versions = {}  # org_id -> version
        
    async def optimize_routing_model(self, org_id: str) -> Dict:
        """Main optimization method - retrain model with latest data"""
        logger.info(f"Starting ML optimization for org {org_id}")
        
        try:
            # 1. Collect training data
            training_data = await self._collect_training_data(org_id)
            
            if len(training_data) < 100:  # Need minimum data
                logger.warning(f"Insufficient training data for org {org_id}: {len(training_data)} samples")
                return {"status": "insufficient_data", "samples": len(training_data)}
            
            # 2. Prepare features and targets
            features, targets = await self._prepare_training_data(training_data, org_id)
            
            # 3. Train model
            model, performance = await self._train_model(features, targets)
            
            # 4. Validate model
            validation_score = await self._validate_model(model, features, targets)
            
            if validation_score > 0.7:  # Minimum performance threshold
                # 5. Deploy model
                await self._deploy_model(org_id, model, performance)
                
                logger.info(f"Model deployed for org {org_id} with validation score: {validation_score}")
                return {
                    "status": "success",
                    "validation_score": validation_score,
                    "training_samples": len(training_data),
                    "model_version": self.model_versions.get(org_id, 1)
                }
            else:
                logger.warning(f"Model performance too low for org {org_id}: {validation_score}")
                return {"status": "performance_too_low", "validation_score": validation_score}
                
        except Exception as e:
            logger.error(f"ML optimization failed for org {org_id}: {e}")
            return {"status": "error", "error": str(e)}
    
    async def predict_routing_success(
        self,
        org_id: str,
        ticket_features: RoutingFeatures,
        candidate_teams: List[str]
    ) -> Dict[str, float]:
        """Predict success probability for each candidate team"""
        
        if org_id not in self.models:
            # Use default heuristics if no trained model
            return await self._heuristic_scoring(ticket_features, candidate_teams)
        
        model = self.models[org_id]
        base_features = ticket_features.to_array()
        
        predictions = {}
        
        for team_id in candidate_teams:
            # Get team-specific features
            team_features = await self._get_team_features(org_id, team_id)
            
            # Combine features
            full_features = np.concatenate([base_features, team_features])
            
            # Predict success probability
            try:
                success_prob = model.predict_proba([full_features])[0][1]  # Probability of success class
                predictions[team_id] = float(success_prob)
            except Exception as e:
                logger.error(f"Prediction error for team {team_id}: {e}")
                predictions[team_id] = 0.5  # Default neutral score
        
        return predictions
    
    async def get_optimization_status(self, org_id: str) -> Dict:
        """Get current optimization status for organization"""
        try:
            return {
                "has_model": org_id in self.models,
                "model_version": self.model_versions.get(org_id),
                "last_trained": await self._get_last_training_time(org_id),
                "training_data_count": await self._count_training_data(org_id),
                "performance_metrics": await self._get_model_performance(org_id)
            }
        except Exception as e:
            logger.error(f"Error getting optimization status: {e}")
            return {"error": str(e)}
    
    async def check_and_update_model(self, org_id: str) -> bool:
        """Check if model needs updating and trigger if necessary"""
        try:
            # Check if enough new data since last training
            new_data_count = await self._count_new_training_data(org_id)
            
            if new_data_count >= 50:  # Threshold for retraining
                logger.info(f"Triggering model update for org {org_id} - {new_data_count} new samples")
                await self.optimize_routing_model(org_id)
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking model update: {e}")
            return False
    
    # ==================== PRIVATE METHODS ====================
    
    async def _collect_training_data(self, org_id: str) -> List[Dict]:
        """Collect historical routing decisions and outcomes"""
        # Query database for routing history
        # This would be a complex query joining:
        # - routing_decisions table
        # - tickets table
        # - routing_feedback table
        # - team_performance table
        
        # Simplified implementation
        cutoff_date = datetime.utcnow() - timedelta(days=90)  # Last 90 days
        
        # Mock data structure - replace with actual database query
        training_data = []
        
        # In real implementation, you'd query:
        # SELECT rd.*, t.*, rf.*, tp.* 
        # FROM routing_decisions rd
        # JOIN tickets t ON rd.ticket_id = t.ticket_id
        # LEFT JOIN routing_feedback rf ON rd.decision_id = rf.decision_id
        # LEFT JOIN team_performance tp ON rd.target_id = tp.team_id
        # WHERE rd.org_id = %s AND rd.created_at >= %s
        
        return training_data
    
    async def _prepare_training_data(
        self,
        raw_data: List[Dict],
        org_id: str
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Convert raw data to features and targets for training"""
        
        features = []
        targets = []
        
        # Create or load encoders for categorical variables
        if org_id not in self.feature_encoders:
            self.feature_encoders[org_id] = await self._create_feature_encoders(raw_data)
        
        encoders = self.feature_encoders[org_id]
        
        for record in raw_data:
            try:
                # Extract features
                feature_vector = RoutingFeatures(
                    priority_encoded=encoders['priority'].get(record['priority'], 0),
                    severity_encoded=encoders['severity'].get(record['severity'], 0),
                    category_encoded=encoders['category'].get(record['category'], 0),
                    customer_tier_encoded=encoders['customer_tier'].get(record.get('customer_tier'), 0),
                    estimated_effort=record.get('estimated_effort', 60),
                    escalation_count=record.get('escalation_count', 0),
                    hour_of_day=record['created_at'].hour,
                    day_of_week=record['created_at'].weekday(),
                    previous_agent_success_rate=record.get('agent_success_rate', 0.5),
                    team_avg_resolution_time=record.get('team_avg_resolution', 120),
                    team_current_load=record.get('team_load', 5),
                    team_capacity_utilization=record.get('capacity_utilization', 0.5),
                    team_sla_performance=record.get('sla_performance', 0.8),
                    agent_skill_match_score=record.get('skill_match', 0.5),
                    queue_depth=record.get('queue_depth', 10),
                    time_to_sla_deadline=record.get('sla_time_remaining', 240),
                    business_hours=1 if record.get('business_hours') else 0
                )
                
                # Calculate target (success score)
                target = await self._calculate_success_score(record)
                
                features.append(feature_vector.to_array())
                targets.append(target)
                
            except Exception as e:
                logger.warning(f"Skipping record due to error: {e}")
                continue
        
        return np.array(features), np.array(targets)
    
    async def _calculate_success_score(self, record: Dict) -> float:
        """Calculate success score from routing outcome"""
        score = 0.0
        
        # Resolution time component (40% weight)
        target_resolution = record.get('sla_target_minutes', 240)
        actual_resolution = record.get('resolution_minutes', target_resolution)
        
        if actual_resolution <= target_resolution:
            time_score = 1.0
        else:
            # Exponential decay for overdue tickets
            time_score = max(0.0, np.exp(-(actual_resolution - target_resolution) / target_resolution))
        
        score += 0.4 * time_score
        
        # Escalation component (20% weight)
        if not record.get('escalated', False):
            score += 0.2
        
        # Customer satisfaction component (30% weight)
        csat = record.get('customer_satisfaction')
        if csat is not None:
            score += 0.3 * (csat - 1) / 4  # Normalize 1-5 scale to 0-1
        else:
            score += 0.15  # Default neutral score
        
        # SLA compliance component (10% weight)
        if record.get('sla_met', True):
            score += 0.1
        
        return min(1.0, max(0.0, score))
    
    async def _train_model(
        self,
        features: np.ndarray,
        targets: np.ndarray
    ) -> Tuple[object, Dict]:
        """Train ML model on prepared data"""
        
        # For production, use proper ML libraries
        # This is a simplified implementation
        
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_squared_error, r2_score
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            features, targets, test_size=0.2, random_state=42
        )
        
        # Train model
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
        model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test)
        
        performance = {
            "mse": mean_squared_error(y_test, y_pred),
            "r2": r2_score(y_test, y_pred),
            "training_samples": len(X_train),
            "test_samples": len(X_test)
        }
        
        return model, performance
    
    async def _validate_model(
        self,
        model: object,
        features: np.ndarray,
        targets: np.ndarray
    ) -> float:
        """Validate model performance"""
        
        # Use cross-validation for more robust validation
        from sklearn.model_selection import cross_val_score
        
        scores = cross_val_score(model, features, targets, cv=5, scoring='r2')
        return float(np.mean(scores))
    
    async def _deploy_model(
        self,
        org_id: str,
        model: object,
        performance: Dict
    ):
        """Deploy trained model for use"""
        
        # Store model
        self.models[org_id] = model
        
        # Update version
        current_version = self.model_versions.get(org_id, 0)
        self.model_versions[org_id] = current_version + 1
        
        # Save to persistent storage
        await self._save_model_to_storage(org_id, model, performance)
        
        logger.info(f"Model deployed for org {org_id}, version {self.model_versions[org_id]}")
    
    async def _heuristic_scoring(
        self,
        ticket_features: RoutingFeatures,
        candidate_teams: List[str]
    ) -> Dict[str, float]:
        """Fallback heuristic scoring when no ML model available"""
        
        scores = {}
        
        for team_id in candidate_teams:
            score = 0.5  # Base score
            
            # Simple heuristics
            if ticket_features.priority_encoded > 2:  # High priority
                score += 0.1
            
            if ticket_features.team_capacity_utilization < 0.7:  # Low utilization
                score += 0.2
            
            if ticket_features.agent_skill_match_score > 0.7:  # Good skill match
                score += 0.2
            
            scores[team_id] = min(1.0, score)
        
        return scores
    
    async def _get_team_features(self, org_id: str, team_id: str) -> np.ndarray:
        """Get real-time team features for prediction"""
        
        # Query current team metrics
        # This would be implemented with actual database queries
        
        # Mock features
        team_features = np.array([
            0.6,  # current_utilization
            95.0,  # avg_resolution_time
            0.85,  # sla_performance
            3,     # current_queue_depth
            0.9    # skill_coverage_score
        ])
        
        return team_features
    
    async def _create_feature_encoders(self, raw_data: List[Dict]) -> Dict:
        """Create label encoders for categorical features"""
        
        encoders = {}
        
        # Priority encoder
        priorities = list(set(record.get('priority', 'normal') for record in raw_data))
        encoders['priority'] = {p: i for i, p in enumerate(sorted(priorities))}
        
        # Severity encoder
        severities = list(set(record.get('severity', 'sev3') for record in raw_data))
        encoders['severity'] = {s: i for i, s in enumerate(sorted(severities))}
        
        # Category encoder
        categories = list(set(record.get('category', 'general') for record in raw_data))
        encoders['category'] = {c: i for i, c in enumerate(sorted(categories))}
        
        # Customer tier encoder
        tiers = list(set(record.get('customer_tier', 'standard') for record in raw_data if record.get('customer_tier')))
        encoders['customer_tier'] = {t: i for i, t in enumerate(sorted(tiers))}
        
        return encoders
    
    async def _get_last_training_time(self, org_id: str) -> Optional[datetime]:
        """Get last training timestamp for organization"""
        # Query from database
        return None
    
    async def _count_training_data(self, org_id: str) -> int:
        """Count total training data samples"""
        # Query from database
        return 0
    
    async def _count_new_training_data(self, org_id: str) -> int:
        """Count new training data since last model update"""
        # Query from database
        return 0
    
    async def _get_model_performance(self, org_id: str) -> Optional[Dict]:
        """Get current model performance metrics"""
        # Retrieve from storage
        return None
    
    async def _save_model_to_storage(
        self,
        org_id: str,
        model: object,
        performance: Dict
    ):
        """Save model to persistent storage"""
        try:
            # In production, save to cloud storage (S3, GCS, etc.)
            model_path = f"models/{org_id}/model_v{self.model_versions[org_id]}.pkl"
            
            # For now, just log
            logger.info(f"Model saved to {model_path}")
            
        except Exception as e:
            logger.error(f"Failed to save model: {e}")

# ==================== ADVANCED FEATURES ====================

class ABTestManager:
    """Manage A/B tests for routing strategies"""
    
    def __init__(self, db: Session):
        self.db = db
        self.active_tests = {}  # org_id -> test_config
    
    async def create_routing_test(
        self,
        org_id: str,
        test_config: Dict
    ) -> str:
        """Create new routing A/B test"""
        
        test_id = f"test_{org_id}_{int(datetime.utcnow().timestamp())}"
        
        # Store test configuration
        self.active_tests[test_id] = {
            "org_id": org_id,
            "config": test_config,
            "start_time": datetime.utcnow(),
            "status": "active"
        }
        
        return test_id
    
    async def should_use_variant(
        self,
        test_id: str,
        ticket_id: str
    ) -> bool:
        """Determine if ticket should use test variant"""
        
        if test_id not in self.active_tests:
            return False
        
        # Simple hash-based assignment
        hash_value = hash(ticket_id) % 100
        split_percentage = self.active_tests[test_id]["config"].get("split_percentage", 50)
        
        return hash_value < split_percentage

# Usage example for integration
async def enhanced_route_with_ml(
    db: Session,
    ticket_context: 'TicketContext',
    candidate_teams: List[str]
) -> Dict[str, float]:
    """Enhanced routing that combines rule-based and ML approaches"""
    
    optimizer = MLRoutingOptimizer(db)
    
    # Create features from ticket context
    features = RoutingFeatures(
        priority_encoded={"low": 0, "normal": 1, "high": 2, "urgent": 3}.get(ticket_context.priority, 1),
        severity_encoded={"sev4": 0, "sev3": 1, "sev2": 2, "sev1": 3}.get(ticket_context.severity, 1),
        category_encoded=hash(ticket_context.category) % 10,  # Simplified encoding
        customer_tier_encoded={"standard": 0, "premium": 1, "enterprise": 2}.get(ticket_context.customer_tier, 0),
        estimated_effort=ticket_context.estimated_effort or 60,
        escalation_count=ticket_context.escalation_count,
        hour_of_day=datetime.utcnow().hour,
        day_of_week=datetime.utcnow().weekday(),
        previous_agent_success_rate=0.8,  # Would be looked up
        team_avg_resolution_time=120,     # Would be calculated
        team_current_load=5,              # Would be queried
        team_capacity_utilization=0.6,   # Would be calculated
        team_sla_performance=0.85,        # Would be queried
        agent_skill_match_score=0.7,      # Would be calculated
        queue_depth=10,                   # Would be queried
        time_to_sla_deadline=ticket_context.sla_deadline.timestamp() - datetime.utcnow().timestamp() if ticket_context.sla_deadline else 240,
        business_hours=1                  # Would be calculated
    )
    
    # Get ML predictions
    ml_scores = await optimizer.predict_routing_success(
        ticket_context.org_id,
        features,
        candidate_teams
    )
    
    return ml_scores