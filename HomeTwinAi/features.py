from datetime import datetime


def determine_mode(temperature, sunset_timestamp):
    after_sunset = False
    if sunset_timestamp:
        after_sunset = datetime.now().timestamp() >= sunset_timestamp

    return "night" if temperature < 20 or after_sunset else "day"


def next_prediction(temperature, occupancy):
    if occupancy == 0:
        return "Devices will stay OFF until someone enters the room."
    if temperature < 25:
        return "Fan will turn ON if temperature rises."
    return "Fan will stay ON unless temperature drops or the room becomes empty."


def build_insights(temperature, occupancy, fan, light, energy_score, mode):
    if occupancy == 0:
        recommendation = "Turn off devices when the room is empty."
    elif temperature > 30 and fan == "ON":
        recommendation = "Keep curtains closed to reduce cooling load."
    elif mode == "night":
        recommendation = "Use night mode lighting and low-power automation."
    else:
        recommendation = "Eco mode is keeping comfort balanced with low energy use."

    if energy_score >= 80:
        insight = "Excellent energy behavior today."
    elif energy_score >= 55:
        insight = "Energy use is moderate; small automations can improve savings."
    else:
        insight = "High usage detected; review occupied devices and cooling settings."

    return {"recommendation": recommendation, "insight": insight}
