from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# DB_USER = "appinfologic"           
# DB_PASSWORD = "uk097188"   
# DB_HOST = "surveyarc-database.cb8mikwii6l9.ap-south-1.rds.amazonaws.com"
# DB_PORT = "5432"
# DB_NAME = "postgres"
DB_USER = "survey_arc_user"           
DB_PASSWORD = "iWhhud18gP5LfGrhoOOBWR3yi7swmPfT"   
DB_HOST = "dpg-d38f7svfte5s73c1kqb0-a.oregon-postgres.render.com"
DB_PORT = "5432"
DB_NAME = "survey_arc"

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, echo=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
