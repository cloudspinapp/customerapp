"""Cloudspin address proxy endpoint tests (hits real upstream)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cloudspin-mobile-dev.preview.emergentagent.com").rstrip("/")
CUSTOMER_ID = "695"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _post(s, path, payload):
    return s.post(f"{BASE_URL}/api/cloudspin/customers/{path}", json=payload, timeout=30)


class TestValidation:
    def test_addresses_missing_customer_id(self, s):
        r = _post(s, "addresses", {})
        assert r.status_code == 400

    def test_get_detail_missing_address_id(self, s):
        r = _post(s, "get_address_detail", {})
        assert r.status_code == 400

    def test_set_default_missing(self, s):
        r = _post(s, "set_default_address", {"customer_id": CUSTOMER_ID})
        assert r.status_code == 400

    def test_add_missing(self, s):
        r = _post(s, "add_address", {})
        assert r.status_code == 400

    def test_update_missing(self, s):
        r = _post(s, "update_address", {"customer_id": CUSTOMER_ID})
        assert r.status_code == 400

    def test_delete_missing(self, s):
        r = _post(s, "delete_address", {"customer_id": CUSTOMER_ID})
        assert r.status_code == 400


class TestAddressFlow:
    created_id = None

    def test_list_addresses(self, s):
        r = _post(s, "addresses", {"customer_id": CUSTOMER_ID})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") is True
        data = body.get("data") or []
        assert isinstance(data, list)
        assert len(data) >= 2, f"Expected >=2 seeded addresses, got {len(data)}"
        # spot-check structure
        a0 = data[0]
        for k in ("ID", "customer_id", "label", "address_line", "city", "state", "pincode"):
            assert k in a0

    def test_get_address_detail(self, s):
        # First list to get an existing ID (id 1 is demo, safe to read)
        lst = _post(s, "addresses", {"customer_id": CUSTOMER_ID}).json()
        aid = lst["data"][0]["ID"]
        r = _post(s, "get_address_detail", {"address_id": aid})
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") is True

    def test_add_update_setdefault_delete(self, s):
        # ADD
        add_payload = {
            "customer_id": CUSTOMER_ID,
            "label": "Other",
            "address_line": "TEST_ADDR pytest line 1",
            "landmark": "Near test",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
            "latitude": "12.97",
            "longitude": "77.59",
            "is_default": "0",
        }
        r = _post(s, "add_address", add_payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") is True, body

        # Find newly created ID — fetch fresh list and pick the one matching our line
        lst = _post(s, "addresses", {"customer_id": CUSTOMER_ID}).json()
        items = lst.get("data") or []
        new_items = [a for a in items if a.get("address_line") == "TEST_ADDR pytest line 1"]
        assert new_items, "Newly added test address not found in list"
        new_id = new_items[-1]["ID"]
        assert str(new_id) not in ("1", "2"), "Refusing to touch demo address 1/2"

        try:
            # UPDATE
            upd_payload = {**add_payload, "address_id": new_id, "address_line": "TEST_ADDR pytest line 1 UPDATED"}
            r = _post(s, "update_address", upd_payload)
            assert r.status_code == 200
            assert r.json().get("status") is True

            # Verify via list (no GET-by-id contract, use list)
            lst2 = _post(s, "addresses", {"customer_id": CUSTOMER_ID}).json()
            found = [a for a in lst2["data"] if a["ID"] == new_id]
            assert found and found[0]["address_line"] == "TEST_ADDR pytest line 1 UPDATED"

            # SET DEFAULT
            r = _post(s, "set_default_address", {"customer_id": CUSTOMER_ID, "address_id": new_id})
            assert r.status_code == 200
            assert r.json().get("status") is True

            lst3 = _post(s, "addresses", {"customer_id": CUSTOMER_ID}).json()
            found = [a for a in lst3["data"] if a["ID"] == new_id]
            assert found and str(found[0].get("is_default")) == "1"
        finally:
            # DELETE (cleanup)
            r = _post(s, "delete_address", {"customer_id": CUSTOMER_ID, "address_id": new_id})
            assert r.status_code == 200
            assert r.json().get("status") is True
            lst4 = _post(s, "addresses", {"customer_id": CUSTOMER_ID}).json()
            assert not [a for a in lst4["data"] if a["ID"] == new_id], "Address not deleted"
