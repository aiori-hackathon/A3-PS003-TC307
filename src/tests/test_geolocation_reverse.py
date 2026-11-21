import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.traffic_provider import (
    SharedTrafficProvider,
    TOMTOM_REVERSE_GEOCODE_BASE_URL,
    NOMINATIM_REVERSE_URL,
)


def test_reverse_geocode_tomtom_primary_preserves_coordinates():
    async def _run():
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "addresses": [
                {
                    "address": {
                        "streetName": "Civil Lines Road",
                        "municipalitySubdivision": "IIT Campus",
                        "municipality": "Roorkee",
                        "countrySecondarySubdivision": "Haridwar",
                        "countrySubdivision": "UK",
                        "countrySubdivisionName": "Uttarakhand",
                        "country": "India",
                        "postalCode": "247667",
                        "freeformAddress": "Civil Lines Road, IIT Campus, Roorkee 247667, Uttarakhand",
                    }
                }
            ]
        }

        provider = SharedTrafficProvider(mode="live", api_key="test_tomtom_secret_key")
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            res = await provider.reverse_geocode(29.854312, 77.888015)

            assert mock_get.call_count == 1
            called_url = mock_get.call_args[0][0]
            assert TOMTOM_REVERSE_GEOCODE_BASE_URL in called_url
            assert res["resolved"] is True
            assert res["source"] == "tomtom_reverse_geocode"
            assert res["city"] == "Roorkee"
            assert res["district"] == "Haridwar"
            assert res["state"] == "Uttarakhand"
            assert res["road"] == "Civil Lines Road"
            assert res["latitude"] == 29.854312
            assert res["longitude"] == 77.888015

    asyncio.run(_run())


def test_reverse_geocode_nominatim_secondary_for_other_cities():
    async def _run():
        tomtom_fail = MagicMock()
        tomtom_fail.status_code = 403

        nominatim_ok = MagicMock()
        nominatim_ok.status_code = 200
        nominatim_ok.json.return_value = {
            "display_name": "Mirza Ismail Road, Panch Batti, Jaipur, Rajasthan, India",
            "address": {
                "road": "Mirza Ismail Road",
                "suburb": "Panch Batti",
                "city": "Jaipur",
                "state_district": "Jaipur",
                "state": "Rajasthan",
                "country": "India",
                "postcode": "302001",
            },
        }

        provider = SharedTrafficProvider(mode="live", api_key="test_tomtom_secret_key")
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = [tomtom_fail, nominatim_ok]
            res = await provider.reverse_geocode(26.9124, 75.7873)

            assert mock_get.call_count == 2
            assert TOMTOM_REVERSE_GEOCODE_BASE_URL in mock_get.call_args_list[0][0][0]
            assert NOMINATIM_REVERSE_URL in mock_get.call_args_list[1][0][0]
            assert "User-Agent" in mock_get.call_args_list[1][1]["headers"]
            assert res["resolved"] is True
            assert res["source"] == "nominatim"
            assert res["city"] == "Jaipur"
            assert res["state"] == "Rajasthan"
            assert res["road"] == "Mirza Ismail Road"
            assert res["latitude"] == 26.9124
            assert res["longitude"] == 75.7873

    asyncio.run(_run())


def test_reverse_geocode_never_substitutes_dehradun_bbox_when_offline():
    async def _run():
        # Coordinates inside the old legacy 30.1..30.6, 77.8..78.3 bounding box or anywhere offline
        provider = SharedTrafficProvider(mode="live", api_key="secret_api_key_value_999")
        with patch(
            "httpx.AsyncClient.get",
            new_callable=AsyncMock,
            side_effect=RuntimeError("DNS failure with secret_api_key_value_999"),
        ):
            res = await provider.reverse_geocode(30.25, 78.05)

            assert res["resolved"] is False
            assert res["source"] == "coordinates_only"
            assert res["city"] == ""
            assert res["state"] == ""
            assert "Dehradun" not in res["city"]
            assert "Dehradun" not in res["full_address"]
            assert "secret_api_key_value_999" not in res.get("reason", "")
            assert res["latitude"] == 30.25
            assert res["longitude"] == 78.05

    asyncio.run(_run())


def test_reverse_geocode_endpoint_and_validation():
    client = TestClient(app)

    invalid_resp = client.get("/api/traffic/reverse-geocode?latitude=95.0&longitude=77.8880")
    assert invalid_resp.status_code == 422

    fake_payload = {
        "resolved": True,
        "latitude": 29.8543,
        "longitude": 77.888,
        "road": "BSM Chowk Road",
        "area": "Roorkee",
        "city": "Roorkee",
        "district": "Haridwar",
        "state": "Uttarakhand",
        "country": "India",
        "postcode": "247667",
        "full_address": "BSM Chowk Road, Roorkee, Haridwar, Uttarakhand",
        "source": "nominatim",
    }
    with patch(
        "backend.app.api.endpoints.traffic_provider_instance.reverse_geocode",
        new_callable=AsyncMock,
        return_value=fake_payload,
    ):
        ok_resp = client.get("/api/traffic/reverse-geocode?latitude=29.8543&longitude=77.8880")
        assert ok_resp.status_code == 200
        body = ok_resp.json()
        assert body["city"] == "Roorkee"
        assert body["district"] == "Haridwar"
        assert body["state"] == "Uttarakhand"
        assert body["latitude"] == 29.8543
        assert body["longitude"] == 77.888
