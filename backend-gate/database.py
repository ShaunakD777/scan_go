from fastapi import FastAPI
from contextlib import asynccontextmanager
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import logging
import os
from dotenv import load_dotenv
import asyncio

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/rfid_gate")

logger = logging.getLogger(__name__)

def get_db_engine():
    """Create database engine with optimized settings"""
    return create_engine(
        DATABASE_URL,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
        echo=False,
        # Connection pool timeout settings
        connect_args={
            "connect_timeout": 5,
            "keepalives": 1,
            "keepalives_idle": 30,
        }
    )

def init_db():
    """Initialize database with schema"""
    engine = get_db_engine()
    
    try:
        # Read and execute schema
        with open('database_schema.sql', 'r') as f:
            schema = f.read()
        
        with engine.connect() as conn:
            # Split by semicolon and execute each statement
            statements = [s.strip() for s in schema.split(';') if s.strip()]
            for statement in statements:
                conn.execute(text(statement))
            conn.commit()
        
        logger.info("Database schema initialized successfully")
        
        # Test query
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM products"))
            count = result.scalar()
            logger.info(f"Database ready. Current products: {count}")
        
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise
    finally:
        engine.dispose()

def test_connection():
    """Test database connection"""
    engine = get_db_engine()
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            logger.info("Database connection test: PASSED")
            return True
    except Exception as e:
        logger.error(f"Database connection test: FAILED - {e}")
        return False
    finally:
        engine.dispose()

if __name__ == "__main__":
    # Initialize database
    init_db()
    
    # Test connection
    test_connection()
