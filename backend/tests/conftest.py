"""Shared fixtures for integration tests against a running server."""
import asyncio
import asyncpg
import pytest
import requests

BASE = "http://localhost:8000/api/v1"
DB_DSN = "postgresql://postgres:postgres@db:5432/vacation_planner"


def _login(login: str, password: str) -> str:
    r = requests.post(f"{BASE}/auth/login", json={"login": login, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


def db_exec(sql: str, *args):
    """Run a SQL statement directly on the database via asyncpg."""
    async def _run():
        conn = await asyncpg.connect(DB_DSN)
        try:
            await conn.execute(sql, *args)
        finally:
            await conn.close()
    asyncio.run(_run())


@pytest.fixture(scope="session")
def manager_token():
    return _login("manager", "manager123")


@pytest.fixture(scope="session")
def manager_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}


@pytest.fixture(scope="session")
def employee_data(manager_headers):
    """Return an employee login that has unlocked wishes."""
    users = requests.get(f"{BASE}/users", headers=manager_headers).json()
    employees = [u for u in users if u["role"] == "EMPLOYEE"]
    assert employees, "No employees in DB"
    emp = employees[0]
    # Unlock this employee's wishes so save-wish tests can run
    db_exec("UPDATE wish_requests SET is_locked = false WHERE user_id = $1", emp["id"])
    return emp


@pytest.fixture(scope="session")
def employee_token(employee_data):
    return _login(employee_data["login"], "password123")


@pytest.fixture(scope="session")
def employee_headers(employee_token):
    return {"Authorization": f"Bearer {employee_token}"}


@pytest.fixture(scope="session")
def first_workshop(manager_headers):
    r = requests.get(f"{BASE}/workshops", headers=manager_headers)
    assert r.status_code == 200
    workshops = r.json()
    assert workshops
    return workshops[0]


@pytest.fixture(scope="session")
def first_shift(first_workshop):
    return first_workshop["shifts"][0]


@pytest.fixture(scope="session")
def temp_workshop(manager_headers):
    """Create a fresh workshop with no coverage rules for testing."""
    r = requests.post(f"{BASE}/workshops", json={"name": "__pytest_temp_ws__"}, headers=manager_headers)
    assert r.status_code == 201
    ws = r.json()
    r2 = requests.post(f"{BASE}/workshops/{ws['id']}/shifts", json={"name": "__pytest_shift__"}, headers=manager_headers)
    ws["shifts"] = [r2.json()] if r2.status_code == 201 else []
    yield ws
    requests.delete(f"{BASE}/workshops/{ws['id']}", headers=manager_headers)
