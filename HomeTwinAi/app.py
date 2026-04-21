import os
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, jsonify, redirect, render_template, request, session, url_for

from energy import calculate_energy
from features import build_insights, determine_mode, next_prediction
from model import predict_devices


app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "smart-home-demo-secret")

USERS = {
    "demo": {"password": "demo123", "preference": "eco"}
}

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not session.get("user"):
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped_view


def _fallback_weather(lat, lon):
    """Demo-friendly weather data when no API key is available."""
    hour = datetime.now().hour
    current_temp = 24 if 7 <= hour <= 18 else 18
    future_temp = current_temp + (2 if hour < 16 else -2)
    mode = determine_mode(current_temp, None)

    return {
        "current_temp": current_temp,
        "future_temp": future_temp,
        "city": "Demo Location",
        "mode": mode,
        "sunset": None,
        "source": "fallback",
        "lat": lat,
        "lon": lon,
    }


def fetch_weather(lat, lon):
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        return _fallback_weather(lat, lon)

    import requests

    params = {
        "lat": lat,
        "lon": lon,
        "appid": api_key,
        "units": "metric",
    }

    weather_response = requests.get(OPENWEATHER_URL, params=params, timeout=8)
    weather_response.raise_for_status()
    weather_data = weather_response.json()

    forecast_response = requests.get(FORECAST_URL, params=params, timeout=8)
    forecast_response.raise_for_status()
    forecast_data = forecast_response.json()

    current_temp = round(weather_data["main"]["temp"], 1)
    future_temp = round(forecast_data["list"][0]["main"]["temp"], 1)
    city = weather_data.get("name") or forecast_data.get("city", {}).get("name") or "Your Location"
    sunset = weather_data.get("sys", {}).get("sunset")
    mode = determine_mode(current_temp, sunset)

    return {
        "current_temp": current_temp,
        "future_temp": future_temp,
        "city": city,
        "mode": mode,
        "sunset": sunset,
        "source": "openweather",
        "lat": lat,
        "lon": lon,
    }


@app.route("/")
def index():
    if session.get("user"):
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/signup", methods=["GET", "POST"])
def signup():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        preference = request.form.get("preference", "eco")

        if len(username) < 3:
            error = "Username must be at least 3 characters."
        elif len(password) < 4:
            error = "Password must be at least 4 characters."
        elif username in USERS:
            error = "That username already exists."
        else:
            USERS[username] = {"password": password, "preference": preference}
            session["user"] = username
            session["preference"] = preference
            return redirect(url_for("dashboard"))

    return render_template("signup.html", error=error)


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = USERS.get(username)

        if user and user["password"] == password:
            session["user"] = username
            session["preference"] = user.get("preference", "eco")
            return redirect(url_for("dashboard"))
        error = "Invalid username or password."

    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/dashboard")
@login_required
def dashboard():
    return render_template(
        "dashboard.html",
        username=session["user"],
        preference=session.get("preference", "eco"),
        active_page="dashboard",
    )


@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    saved = False
    username = session["user"]
    user = USERS.setdefault(username, {"password": "", "preference": "eco"})

    if request.method == "POST":
        preference = request.form.get("preference", "eco")
        user["preference"] = preference
        session["preference"] = preference
        saved = True

    return render_template(
        "profile.html",
        username=username,
        preference=user.get("preference", "eco"),
        active_page="profile",
        saved=saved,
    )


@app.route("/weather")
@login_required
def weather():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon query parameters are required"}), 400

    try:
        return jsonify(fetch_weather(lat, lon))
    except Exception:
        return jsonify(_fallback_weather(lat, lon))


@app.route("/predict", methods=["POST"])
@login_required
def predict():
    payload = request.get_json(silent=True) or {}
    temperature = float(payload.get("temperature", 24))
    occupancy = int(payload.get("occupancy", 1))
    mode = payload.get("mode", "day")
    eco_mode = bool(payload.get("eco_mode", True))
    preference = payload.get("preference", "eco")
    model_temperature = temperature + 1.5 if preference == "comfort" else temperature

    prediction = predict_devices(model_temperature, occupancy)
    next_prediction_data = predict_devices(model_temperature + 3, occupancy)
    energy = calculate_energy(
        fan=prediction["fan"],
        light=prediction["light"],
        occupancy=occupancy,
        eco_mode=eco_mode,
    )
    predicted_energy = calculate_energy(
        fan=next_prediction_data["fan"],
        light=next_prediction_data["light"],
        occupancy=occupancy,
        eco_mode=eco_mode,
    )
    insight_data = build_insights(
        temperature=temperature,
        occupancy=occupancy,
        fan=prediction["fan"],
        light=prediction["light"],
        energy_score=energy["energy_score"],
        mode=mode,
    )
    recommendation = insight_data["recommendation"]
    if preference == "comfort" and occupancy == 1:
        recommendation = "Comfort mode is prioritizing a faster response to warmth."

    return jsonify(
        {
            "fan": prediction["fan"],
            "light": prediction["light"],
            "reason": prediction["reason"],
            "next_prediction": next_prediction(temperature, occupancy),
            "energy_usage": energy["energy_usage"],
            "energy_waste": energy["energy_waste"],
            "energy_saved": energy["energy_saved"],
            "energy_score": energy["energy_score"],
            "predicted_usage": predicted_energy["energy_usage"],
            "recommendation": recommendation,
            "insight": insight_data["insight"],
            "profile_impact": "Eco preference lowers idle usage." if eco_mode else "Comfort preference reacts earlier to warmth.",
        }
    )


@app.template_filter("datetime")
def format_datetime(value):
    return datetime.fromtimestamp(value, tz=timezone.utc).strftime("%H:%M UTC")


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
