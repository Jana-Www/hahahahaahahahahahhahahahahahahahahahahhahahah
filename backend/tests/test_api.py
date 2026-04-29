"""
Regression integration tests for all API endpoints.
Requires running server at http://localhost:8000 with seeded data.

Run:  pytest tests/test_api.py -v
"""
import pytest
import requests

BASE = "http://localhost:8000/api/v1"
YEAR = 2026


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self):
        r = requests.get(f"{BASE}/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "version" in data


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_manager_success(self):
        r = requests.post(f"{BASE}/auth/login", json={"login": "manager", "password": "manager123"})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["login"] == "manager"
        assert data["user"]["role"] == "MANAGER"

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE}/auth/login", json={"login": "manager", "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_user(self):
        r = requests.post(f"{BASE}/auth/login", json={"login": "nobody", "password": "x"})
        assert r.status_code == 401

    def test_me_manager(self, manager_headers):
        r = requests.get(f"{BASE}/auth/me", headers=manager_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "MANAGER"

    def test_me_unauthorized(self):
        r = requests.get(f"{BASE}/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{BASE}/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Workshops
# ─────────────────────────────────────────────────────────────────────────────

class TestWorkshops:
    def test_list_workshops_authenticated(self, manager_headers):
        r = requests.get(f"{BASE}/workshops", headers=manager_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "id" in data[0]
        assert "name" in data[0]
        assert "shifts" in data[0]

    def test_list_workshops_unauthorized(self):
        r = requests.get(f"{BASE}/workshops")
        assert r.status_code == 401

    def test_list_workshops_employee(self, employee_headers):
        r = requests.get(f"{BASE}/workshops", headers=employee_headers)
        assert r.status_code == 200

    def test_create_workshop_manager(self, manager_headers):
        r = requests.post(f"{BASE}/workshops", json={"name": "Test Workshop"}, headers=manager_headers)
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Test Workshop"
        assert "id" in data
        # cleanup
        requests.delete(f"{BASE}/workshops/{data['id']}", headers=manager_headers)

    def test_create_workshop_employee_forbidden(self, employee_headers):
        r = requests.post(f"{BASE}/workshops", json={"name": "Forbidden"}, headers=employee_headers)
        assert r.status_code == 403

    def test_update_workshop(self, manager_headers):
        r = requests.post(f"{BASE}/workshops", json={"name": "To Update"}, headers=manager_headers)
        assert r.status_code == 201
        ws_id = r.json()["id"]
        r2 = requests.put(f"{BASE}/workshops/{ws_id}", json={"name": "Updated Name"}, headers=manager_headers)
        assert r2.status_code == 200
        assert r2.json()["name"] == "Updated Name"
        requests.delete(f"{BASE}/workshops/{ws_id}", headers=manager_headers)

    def test_delete_workshop(self, manager_headers):
        r = requests.post(f"{BASE}/workshops", json={"name": "To Delete"}, headers=manager_headers)
        ws_id = r.json()["id"]
        r2 = requests.delete(f"{BASE}/workshops/{ws_id}", headers=manager_headers)
        assert r2.status_code == 204

    def test_delete_nonexistent_workshop(self, manager_headers):
        r = requests.delete(f"{BASE}/workshops/00000000-0000-0000-0000-000000000000", headers=manager_headers)
        assert r.status_code == 404

    def test_list_shifts(self, manager_headers, first_workshop):
        ws_id = first_workshop["id"]
        r = requests.get(f"{BASE}/workshops/{ws_id}/shifts", headers=manager_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_and_delete_shift(self, manager_headers, first_workshop):
        ws_id = first_workshop["id"]
        r = requests.post(f"{BASE}/workshops/{ws_id}/shifts", json={"name": "Test Shift"}, headers=manager_headers)
        assert r.status_code == 201
        shift_id = r.json()["id"]
        r2 = requests.delete(f"{BASE}/workshops/{ws_id}/shifts/{shift_id}", headers=manager_headers)
        assert r2.status_code == 204

    def test_create_shift_unknown_workshop(self, manager_headers):
        r = requests.post(
            f"{BASE}/workshops/00000000-0000-0000-0000-000000000000/shifts",
            json={"name": "X"},
            headers=manager_headers,
        )
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────────────────────────

class TestUsers:
    def test_list_users_manager(self, manager_headers):
        r = requests.get(f"{BASE}/users", headers=manager_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_list_users_employee_forbidden(self, employee_headers):
        r = requests.get(f"{BASE}/users", headers=employee_headers)
        assert r.status_code == 403

    def test_list_users_unauthorized(self):
        r = requests.get(f"{BASE}/users")
        assert r.status_code == 401

    def test_get_me_employee(self, employee_headers):
        r = requests.get(f"{BASE}/users/me", headers=employee_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "EMPLOYEE"

    def test_create_update_delete_user(self, manager_headers, first_shift):
        shift_id = first_shift["id"]
        payload = {
            "full_name": "Test User Pytest",
            "login": "test_pytest_user",
            "password": "testpass123",
            "role": "EMPLOYEE",
            "qualification": "STD",
            "shift_id": shift_id,
            "vacation_days_norm": 28,
            "vacation_days_used": 0,
        }
        r = requests.post(f"{BASE}/users", json=payload, headers=manager_headers)
        assert r.status_code == 201
        user_id = r.json()["id"]
        assert r.json()["full_name"] == "Test User Pytest"

        r2 = requests.put(f"{BASE}/users/{user_id}", json={"full_name": "Updated Pytest"}, headers=manager_headers)
        assert r2.status_code == 200
        assert r2.json()["full_name"] == "Updated Pytest"

        r3 = requests.get(f"{BASE}/users/{user_id}", headers=manager_headers)
        assert r3.status_code == 200

        r4 = requests.delete(f"{BASE}/users/{user_id}", headers=manager_headers)
        assert r4.status_code == 204

    def test_get_nonexistent_user(self, manager_headers):
        r = requests.get(f"{BASE}/users/00000000-0000-0000-0000-000000000000", headers=manager_headers)
        assert r.status_code == 404

    def test_delete_nonexistent_user(self, manager_headers):
        r = requests.delete(f"{BASE}/users/00000000-0000-0000-0000-000000000000", headers=manager_headers)
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Season Periods
# ─────────────────────────────────────────────────────────────────────────────

class TestSeasonPeriods:
    def test_list_season_periods(self, manager_headers):
        r = requests.get(f"{BASE}/season-periods", params={"year": YEAR}, headers=manager_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_season_periods_no_year(self, manager_headers):
        r = requests.get(f"{BASE}/season-periods", headers=manager_headers)
        assert r.status_code == 422

    def test_list_season_periods_unauthorized(self):
        r = requests.get(f"{BASE}/season-periods", params={"year": YEAR})
        assert r.status_code == 401

    def test_create_update_delete_season_period(self, manager_headers):
        payload = {
            "year": 2099,
            "date_start": "2099-07-01",
            "date_end": "2099-08-31",
            "status": "HIGH",
        }
        r = requests.post(f"{BASE}/season-periods", json=payload, headers=manager_headers)
        assert r.status_code == 201
        period_id = r.json()["id"]
        assert r.json()["status"] == "HIGH"

        r2 = requests.put(
            f"{BASE}/season-periods/{period_id}",
            json={"status": "LOW"},
            headers=manager_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "LOW"

        r3 = requests.delete(f"{BASE}/season-periods/{period_id}", headers=manager_headers)
        assert r3.status_code == 204

    def test_create_season_period_employee_forbidden(self, employee_headers):
        payload = {"year": 2099, "date_start": "2099-01-01", "date_end": "2099-01-31", "status": "NEUTRAL"}
        r = requests.post(f"{BASE}/season-periods", json=payload, headers=employee_headers)
        assert r.status_code == 403

    def test_delete_nonexistent_period(self, manager_headers):
        r = requests.delete(f"{BASE}/season-periods/00000000-0000-0000-0000-000000000000", headers=manager_headers)
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Coverage Rules
# ─────────────────────────────────────────────────────────────────────────────

class TestCoverageRules:
    def test_list_coverage_rules(self, manager_headers):
        r = requests.get(f"{BASE}/coverage-rules", headers=manager_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_coverage_rules_filter_by_workshop(self, manager_headers, first_workshop):
        ws_id = first_workshop["id"]
        r = requests.get(f"{BASE}/coverage-rules", params={"workshop_id": ws_id}, headers=manager_headers)
        assert r.status_code == 200
        data = r.json()
        assert all(item["workshop_id"] == ws_id for item in data)

    def test_list_coverage_rules_employee(self, employee_headers):
        r = requests.get(f"{BASE}/coverage-rules", headers=employee_headers)
        assert r.status_code == 200

    def test_list_coverage_rules_unauthorized(self):
        r = requests.get(f"{BASE}/coverage-rules")
        assert r.status_code == 401

    def test_create_update_delete_coverage_rule(self, manager_headers, temp_workshop):
        """Use a fresh workshop (no existing rules) to avoid unique-constraint collisions."""
        ws_id = temp_workshop["id"]
        payload = {
            "workshop_id": ws_id,
            "period_status": "NEUTRAL",
            "min_total": 3,
            "min_key": 1,
            "max_on_vacation": 2,
        }
        r = requests.post(f"{BASE}/coverage-rules", json=payload, headers=manager_headers)
        assert r.status_code == 201
        rule_id = r.json()["id"]

        r2 = requests.put(
            f"{BASE}/coverage-rules/{rule_id}",
            json={"min_total": 5, "min_key": 2},
            headers=manager_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["min_total"] == 5

        r3 = requests.delete(f"{BASE}/coverage-rules/{rule_id}", headers=manager_headers)
        assert r3.status_code == 204

    def test_create_coverage_rule_employee_forbidden(self, employee_headers, temp_workshop):
        ws_id = temp_workshop["id"]
        payload = {"workshop_id": ws_id, "period_status": "LOW", "min_total": 1, "min_key": 0}
        r = requests.post(f"{BASE}/coverage-rules", json=payload, headers=employee_headers)
        assert r.status_code == 403

    def test_delete_nonexistent_rule(self, manager_headers):
        r = requests.delete(f"{BASE}/coverage-rules/00000000-0000-0000-0000-000000000000", headers=manager_headers)
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Wishes
# ─────────────────────────────────────────────────────────────────────────────

class TestWishes:
    def test_get_my_wishes_employee(self, employee_headers):
        r = requests.get(f"{BASE}/wishes/my", params={"year": YEAR}, headers=employee_headers)
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert data["year"] == YEAR

    def test_get_my_wishes_no_year(self, employee_headers):
        r = requests.get(f"{BASE}/wishes/my", headers=employee_headers)
        assert r.status_code == 422

    def test_get_my_wishes_unauthorized(self):
        r = requests.get(f"{BASE}/wishes/my", params={"year": YEAR})
        assert r.status_code == 401

    def test_save_my_wishes(self, employee_headers, employee_data):
        """employee_data fixture unlocks the wish before this test runs."""
        payload = {
            "v1_start": "2026-08-01",
            "v1_end": "2026-08-14",
            "v1_comment": "Хочу летом",
        }
        r = requests.put(f"{BASE}/wishes/my", params={"year": YEAR}, json=payload, headers=employee_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["v1_start"] == "2026-08-01"
        assert data["v1_end"] == "2026-08-14"

    def test_save_wishes_exceeds_balance(self, employee_headers, employee_data):
        """Wishes are unlocked by employee_data fixture."""
        payload = {
            "v1_start": "2026-01-01",
            "v1_end": "2026-12-31",
        }
        r = requests.put(f"{BASE}/wishes/my", params={"year": YEAR}, json=payload, headers=employee_headers)
        assert r.status_code == 400

    def test_list_all_wishes_manager(self, manager_headers):
        r = requests.get(f"{BASE}/wishes", params={"year": YEAR}, headers=manager_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            assert "user" in data[0]

    def test_list_all_wishes_employee_forbidden(self, employee_headers):
        r = requests.get(f"{BASE}/wishes", params={"year": YEAR}, headers=employee_headers)
        assert r.status_code == 403

    def test_list_all_wishes_unauthorized(self):
        r = requests.get(f"{BASE}/wishes", params={"year": YEAR})
        assert r.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Vacation Blocks
# ─────────────────────────────────────────────────────────────────────────────

class TestVacationBlocks:
    def test_list_vacation_blocks_manager(self, manager_headers):
        r = requests.get(f"{BASE}/vacation-blocks", params={"year": YEAR}, headers=manager_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_vacation_blocks_unauthorized(self):
        r = requests.get(f"{BASE}/vacation-blocks", params={"year": YEAR})
        assert r.status_code == 401

    def test_list_vacation_blocks_employee_forbidden(self, employee_headers):
        r = requests.get(f"{BASE}/vacation-blocks", params={"year": YEAR}, headers=employee_headers)
        assert r.status_code == 403

    def test_get_my_block_employee(self, employee_headers):
        r = requests.get(f"{BASE}/vacation-blocks/my", params={"year": YEAR}, headers=employee_headers)
        assert r.status_code == 200

    def test_get_my_block_unauthorized(self):
        r = requests.get(f"{BASE}/vacation-blocks/my", params={"year": YEAR})
        assert r.status_code == 401

    def test_update_nonexistent_block(self, manager_headers):
        r = requests.put(
            f"{BASE}/vacation-blocks/00000000-0000-0000-0000-000000000000",
            json={"status": "APPROVED"},
            headers=manager_headers,
        )
        assert r.status_code == 404

    def test_update_block_employee_forbidden(self, employee_headers):
        r = requests.put(
            f"{BASE}/vacation-blocks/00000000-0000-0000-0000-000000000000",
            json={"status": "APPROVED"},
            headers=employee_headers,
        )
        assert r.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────────────────────────────────────

class TestDashboard:
    def test_dashboard_manager(self, manager_headers):
        r = requests.get(f"{BASE}/dashboard", params={"year": YEAR}, headers=manager_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_employees" in data
        assert "approved" in data
        assert "pending" in data
        assert "draft" in data
        assert "conflict" in data
        assert "modified" in data
        assert "without_wishes" in data
        assert data["total_employees"] > 0

    def test_dashboard_unauthorized(self):
        r = requests.get(f"{BASE}/dashboard", params={"year": YEAR})
        assert r.status_code == 401

    def test_dashboard_employee_forbidden(self, employee_headers):
        r = requests.get(f"{BASE}/dashboard", params={"year": YEAR}, headers=employee_headers)
        assert r.status_code == 403

    def test_dashboard_no_year(self, manager_headers):
        r = requests.get(f"{BASE}/dashboard", headers=manager_headers)
        assert r.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Conflicts
# ─────────────────────────────────────────────────────────────────────────────

class TestConflicts:
    def test_get_conflicts_manager(self, manager_headers):
        r = requests.get(f"{BASE}/conflicts", params={"year": YEAR}, headers=manager_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for item in data:
            assert "code" in item
            assert "severity" in item
            assert "description" in item

    def test_get_conflicts_unauthorized(self):
        r = requests.get(f"{BASE}/conflicts", params={"year": YEAR})
        assert r.status_code == 401

    def test_get_conflicts_employee_forbidden(self, employee_headers):
        r = requests.get(f"{BASE}/conflicts", params={"year": YEAR}, headers=employee_headers)
        assert r.status_code == 403

    def test_get_conflicts_no_year(self, manager_headers):
        r = requests.get(f"{BASE}/conflicts", headers=manager_headers)
        assert r.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Schedule
# ─────────────────────────────────────────────────────────────────────────────

class TestSchedule:
    def test_get_status_manager(self, manager_headers):
        r = requests.get(f"{BASE}/schedule/status", params={"year": YEAR}, headers=manager_headers)
        assert r.status_code == 200

    def test_get_status_unauthorized(self):
        r = requests.get(f"{BASE}/schedule/status", params={"year": YEAR})
        assert r.status_code == 401

    def test_get_status_employee_forbidden(self, employee_headers):
        r = requests.get(f"{BASE}/schedule/status", params={"year": YEAR}, headers=employee_headers)
        assert r.status_code == 403

    def test_generate_schedule_employee_forbidden(self, employee_headers):
        r = requests.post(f"{BASE}/schedule/generate", params={"year": YEAR}, headers=employee_headers)
        assert r.status_code == 403

    def test_generate_schedule_unauthorized(self):
        r = requests.post(f"{BASE}/schedule/generate", params={"year": YEAR})
        assert r.status_code == 401

    def test_generate_schedule_manager(self, manager_headers):
        """Schedule generation returns 202 and creates a job."""
        r = requests.post(f"{BASE}/schedule/generate", params={"year": 2099}, headers=manager_headers)
        assert r.status_code in (202, 409)
        if r.status_code == 202:
            data = r.json()
            assert "id" in data
            assert data["year"] == 2099
            assert data["status"] == "RUNNING"

    def test_generate_schedule_conflict_if_running(self, manager_headers):
        """Second generate call for same year returns 409 if still RUNNING."""
        # Use a unique year unlikely to collide
        r1 = requests.post(f"{BASE}/schedule/generate", params={"year": 2098}, headers=manager_headers)
        if r1.status_code == 202:
            r2 = requests.post(f"{BASE}/schedule/generate", params={"year": 2098}, headers=manager_headers)
            assert r2.status_code == 409

    def test_cancel_schedule_no_job(self, manager_headers):
        r = requests.post(f"{BASE}/schedule/cancel", params={"year": 2199}, headers=manager_headers)
        assert r.status_code == 404

    def test_cancel_schedule_employee_forbidden(self, employee_headers):
        r = requests.post(f"{BASE}/schedule/cancel", params={"year": YEAR}, headers=employee_headers)
        assert r.status_code == 403

    def test_cancel_schedule_unauthorized(self):
        r = requests.post(f"{BASE}/schedule/cancel", params={"year": YEAR})
        assert r.status_code == 401
