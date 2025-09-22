from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.project import Project
from ..schemas.project import ProjectCreate, ProjectUpdate, ProjectBase, ProjectGetBase
from typing import List


router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("/", response_model=ProjectBase)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(**data.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/{org_id}", response_model=List[ProjectGetBase])
def get_all_projects(org_id: str, db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.org_id == org_id).all()
    return projects

@router.get("/{org_id}/{project_id}", response_model=ProjectUpdate)
def get_project(org_id: str, project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.project_id == project_id, Project.org_id == org_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.patch("/{org_id}/{project_id}", response_model=ProjectBase)
def update_project(org_id: str, project_id: str, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.project_id == project_id, Project.org_id == org_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project

@router.delete("/{org_id}/{project_id}")
def delete_project(org_id: str, project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.project_id == project_id, Project.org_id == org_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"detail": "Project deleted"}
