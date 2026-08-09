import unittest

from fastapi.testclient import TestClient

from backend.main import MirrorHub, app


class FakeSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.messages: list[str] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_text(self, line: str) -> None:
        self.messages.append(line)


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


class MirrorHubTests(unittest.IsolatedAsyncioTestCase):
    async def test_late_viewer_gets_authoritative_note_snapshot(self) -> None:
        hub = MirrorHub()
        host = FakeSocket()
        viewer = FakeSocket()

        await hub.join(host)
        await hub.relay("PICO_LINK_ON", host)
        await hub.relay("NOTE_C4_ON", host)
        await hub.relay("PICO_NOTES_C4,E4", host)
        await hub.join(viewer)

        self.assertTrue(viewer.accepted)
        self.assertEqual(viewer.messages, ["PICO_LINK_ON", "PICO_NOTES_C4,E4"])

    async def test_publisher_disconnect_releases_mirrored_notes(self) -> None:
        hub = MirrorHub()
        host = FakeSocket()
        viewer = FakeSocket()

        await hub.join(host)
        await hub.join(viewer)
        await hub.relay("PICO_LINK_ON", host)
        await hub.relay("NOTE_G4_ON", host)
        await hub.leave(host)

        self.assertEqual(viewer.messages[-2:], ["PICO_NOTES_", "PICO_LINK_OFF"])

    async def test_viewer_cannot_publish_note_events(self) -> None:
        hub = MirrorHub()
        host = FakeSocket()
        viewer = FakeSocket()

        await hub.join(host)
        await hub.join(viewer)
        await hub.relay("PICO_LINK_ON", host)
        host.messages.clear()
        await hub.relay("NOTE_A4_ON", viewer)

        self.assertEqual(host.messages, [])


if __name__ == "__main__":
    unittest.main()
