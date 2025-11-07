from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging
import sys

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


DB_PASSWORD = "npg_Zv5D7XodmSOj"
DB_HOST = "ep-billowing-waterfall-adc1aqpv-pooler.c-2.us-east-1.aws.neon.tech"
DB_PORT = "5432"
DB_NAME = "neondb"
DB_USER = "neondb_owner"

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create engine with connection pooling settings
engine = create_engine(
    DATABASE_URL, 
    echo=True,
    pool_pre_ping=True,      # Test connections before use
    pool_recycle=300,        # Recycle connections after 5 minutes
    pool_size=5,
    max_overflow=10
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def test_database_connection():
    """Test database connection and log the result"""
    try:
        # Test the connection
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            row = result.fetchone()
            
        logger.info("✅ Database connection successful!")
        logger.info(f"📍 Connected to: {DB_HOST}:{DB_PORT}/{DB_NAME}")
        logger.info(f"👤 User: {DB_USER}")
        return True
        
    except Exception as e:
        logger.error("❌ Database connection failed!")
        logger.error(f"💥 Error: {str(e)}")
        logger.error(f"🔗 Attempted connection to: {DB_HOST}:{DB_PORT}/{DB_NAME}")
        return False

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Test connection on import
if __name__ != "__main__":  # Only test when imported, not when run directly
    connection_success = test_database_connection()
    if not connection_success:
        logger.warning("⚠️  Application started with database connection issues")

# If you want to test connection when running this file directly
if __name__ == "__main__":
    print("Testing database connection...")
    if test_database_connection():
        print("Database connection test passed!")
    else:
        print("Database connection test failed!")
        sys.exit(1)