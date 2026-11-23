import io
import json
import unittest
from unittest import mock

from pipeline import youtube as y


def fake(items):
    def urlopen(req, timeout=30):
        url = req.full_url if hasattr(req, "full_url") else req
        if "oauth2" in url or "token" in url:
            return io.BytesIO(json.dumps({"access_token": "AT"}).encode())
        return io.BytesIO(json.dumps({"items": items}).encode())
    return urlopen


class Guard(unittest.TestCase):
    def run_with(self, env, items):
        with mock.patch.dict("os.environ", {env: "RT"}, clear=False), \
                mock.patch("urllib.request.urlopen", side_effect=fake(items)):
            return y.access_token("c", "s", "RT")

    def test_uncle_ok(self):
        self.assertEqual(self.run_with("YT_REFRESH_TOKEN", [{"id": "UCJP54ReVRA9V2J1sWBNrdKA", "snippet": {"title": "돈 줍는 삼촌"}}]), "AT")

    def test_raksil_token_on_uncle_channel_blocked(self):
        with self.assertRaises(y.WrongChannel):
            self.run_with("RAKSIL_YT_REFRESH_TOKEN", [{"id": "UCJP54ReVRA9V2J1sWBNrdKA", "snippet": {"title": "돈 줍는 삼촌"}}])

    def test_music_ok_by_id(self):
        self.assertEqual(self.run_with("MUSIC_YT_REFRESH_TOKEN", [{"id": "UC9QfcJmskQ2QJETKejujFyQ", "snippet": {"title": "BEEKAY SONGS"}}]), "AT")

    def test_music_same_name_other_id_blocked(self):
        with self.assertRaises(y.WrongChannel):
            self.run_with("MUSIC_YT_REFRESH_TOKEN", [{"id": "UCX", "snippet": {"title": "BEEKAY SONGS"}}])

    def test_webnovel_ok_by_name(self):
        self.assertEqual(self.run_with("WEBNOVEL_YT_REFRESH_TOKEN", [{"id": "UCW", "snippet": {"title": "한 화만 더"}}]), "AT")

    def test_unverifiable_blocked(self):
        with self.assertRaises(y.WrongChannel):
            self.run_with("MUSIC_YT_REFRESH_TOKEN", [])

    def test_unmapped_token_passes(self):
        with mock.patch("urllib.request.urlopen", side_effect=fake([])):
            self.assertEqual(y.access_token("c", "s", "OTHER"), "AT")


if __name__ == "__main__":
    unittest.main()
