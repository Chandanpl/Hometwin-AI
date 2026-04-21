from sklearn.tree import DecisionTreeClassifier


FAN_LABELS = {0: "OFF", 1: "ON"}
LIGHT_LABELS = {0: "OFF", 1: "ON"}


def _train_model():
    # Features: [temperature, occupancy]
    training_data = [
        [14, 0],
        [16, 1],
        [18, 0],
        [19, 1],
        [21, 0],
        [22, 1],
        [24, 0],
        [25, 1],
        [28, 0],
        [29, 1],
        [32, 0],
        [34, 1],
    ]

    # Labels: [fan, light]
    targets = [
        [0, 0],
        [0, 1],
        [0, 0],
        [0, 1],
        [0, 0],
        [0, 0],
        [0, 0],
        [1, 0],
        [0, 0],
        [1, 0],
        [0, 0],
        [1, 0],
    ]

    classifier = DecisionTreeClassifier(max_depth=4, random_state=42)
    classifier.fit(training_data, targets)
    return classifier


MODEL = _train_model()


def predict_devices(temperature, occupancy):
    fan_value, light_value = MODEL.predict([[temperature, occupancy]])[0]
    fan = FAN_LABELS[int(fan_value)]
    light = LIGHT_LABELS[int(light_value)]

    if occupancy == 0:
        reason = "Room is empty, so devices stay off to prevent energy waste."
    elif fan == "ON":
        reason = "Room is occupied and warm, so cooling is activated."
    elif light == "ON":
        reason = "Room is occupied and cool, so lighting is prioritized."
    else:
        reason = "Conditions are comfortable, so devices remain on standby."

    return {"fan": fan, "light": light, "reason": reason}
