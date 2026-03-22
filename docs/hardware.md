# Hardware Configuration

## Components Required
- ESP32
- RC522 RFID Module
- Buzzer
- Jumper wires
- USB cable

## Pin Connections

### RC522 → ESP32

| RC522 Pin | ESP32 Pin |
|----------|----------|
| SDA (SS) | GPIO 5  |
| SCK      | GPIO 18 |
| MOSI     | GPIO 23 |
| MISO     | GPIO 19 |
| RST      | GPIO 22 |
| GND      | GND     |
| 3.3V     | 3.3V    |

### Buzzer → ESP32

| Buzzer Pin | ESP32 Pin |
|-----------|----------|
| VCC       | GPIO 15  |
| GND       | GND      |

## Arduino Code

```cpp
/*
 * Simple ESP32 RFID Reader with Buzzer (Low Latency + LEDC Fix)
 * Works on ESP32 core 2.x and 3.x
 */

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define SS_PIN          5
#define RST_PIN         27
#define BUZZER_PIN      25
#define LEDC_CHANNEL    0      // 0-15 available
#define LEDC_FREQ       1000   // 1kHz tone
#define LEDC_RESOLUTION 10     // 10-bit (0-1023)

MFRC522 rfid(SS_PIN, RST_PIN);

const char* ssid = "Your Wifi Name";
const char* password = "Your Wifi Password";
const char* serverUrl = "http://Your_device_IPv4_Address:8000/check-payment";   // ← Update if IP changes

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  pinMode(BUZZER_PIN, OUTPUT);

  // === LEDC INITIALIZATION (fixes "LEDC not initialized" error) ===
  ledcSetup(LEDC_CHANNEL, LEDC_FREQ, LEDC_RESOLUTION);
  ledcAttachPin(BUZZER_PIN, LEDC_CHANNEL);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi. IP: " + WiFi.localIP().toString());
  Serial.println("Tap RFID card...");
}

void loop() {
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();

    Serial.println("UID: " + uid);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");
      http.setConnectTimeout(2000);
      http.setTimeout(5000);

      String payload = "{\"rfid_id\":\"" + uid + "\"}";
      int httpCode = http.POST(payload);

      if (httpCode > 0) {
        String response = http.getString();
        Serial.println("Response: " + response);

        StaticJsonDocument<200> doc;
        if (deserializeJson(doc, response) == DeserializationError::Ok && doc.containsKey("paid")) {
          bool paid = doc["paid"];
          if (paid) {
            Serial.println("Payment done - Access granted");
          } else {
            Serial.println("Payment not done - Access denied");
            for (int i = 0; i < 3; i++) {
              ledcWrite(LEDC_CHANNEL, 512);   // 50% duty = sound
              delay(300);
              ledcWrite(LEDC_CHANNEL, 0);     // off
              delay(200);
            }
          }
        }
      } else {
        Serial.println("HTTP Error: " + String(httpCode));
      }
      http.end();
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    delay(1500);        // Reduced debounce
  }
}

```
## 5. ⚙️ Setup Instructions

```md
## Setup

1. Install Arduino IDE
2. Install ESP32 board package
3. Install MFRC522 library
4. Select correct COM port
5. Upload code

## Output

- Card unpaid → buzzer beeps
- Card paid → buzzer should not beep