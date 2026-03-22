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
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define SS_PIN 5
#define RST_PIN 27
#define BUZZER_PIN 25
#define LEDC_CHANNEL 0

MFRC522 rfid(SS_PIN, RST_PIN);

const char* ssid = "Your Wifi  Name";
const char* password = "Your Wifi Password";

// ==================== CHANGE THIS LINE EVERY TIME ====================
const char* serverBaseUrl = "http://your_laptop_IPv4_address:8000/check-payment?rfid_id=";  
// ←←← Put your CURRENT laptop IPv4 here ↑↑↑
// =====================================================================

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  pinMode(BUZZER_PIN, OUTPUT);

  ledcSetup(LEDC_CHANNEL, 1000, 10);
  ledcAttachPin(BUZZER_PIN, LEDC_CHANNEL);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected. IP: " + WiFi.localIP().toString());
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

    HTTPClient http;
    String url = String(serverBaseUrl) + uid;
    http.begin(url);
    http.setConnectTimeout(3000);
    http.setTimeout(6000);

    int code = http.GET();

    Serial.print("HTTP Code: ");
    Serial.println(code);

    if (code > 0) {
      String resp = http.getString();
      Serial.println("Response: " + resp);

      StaticJsonDocument<200> doc;
      if (deserializeJson(doc, resp) == DeserializationError::Ok && doc.containsKey("paid")) {
        bool paid = doc["paid"];
        if (paid) {
          Serial.println(">>> ACCESS GRANTED - No beep");
        } else {
          Serial.println(">>> ACCESS DENIED");
          for (int i = 0; i < 3; i++) {
            ledcWrite(LEDC_CHANNEL, 512);
            delay(300);
            ledcWrite(LEDC_CHANNEL, 0);
            delay(200);
          }
        }
      }
    } else {
      Serial.println("Connection failed (Error " + String(code) + ")");
    }
    http.end();

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    delay(1500);
  }
}

```
## 5. Setup Instructions

```md
## Setup

1. Install Arduino IDE
2. Install ESP32 board package
3. Install MFRC522 library
4. Select correct COM port
5. Upload code
```
## 6. Output

- Card unpaid → buzzer beeps
- Card paid → buzzer should not beep
