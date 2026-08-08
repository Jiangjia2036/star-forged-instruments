import unittest

from fastapi.testclient import TestClient

from backend.main import app


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_health(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["serial_transport"], "web-serial")

    def test_project_architecture(self) -> None:
        response = self.client.get("/api/project")

        self.assertEqual(response.status_code, 200)
        self.assertIn("fastapi", response.json()["architecture"])
        self.assertEqual(response.json()["pages"], ["perform", "instrument", "band"])


if __name__ == "__main__":
    unittest.main()
