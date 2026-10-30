# Face unlock

Sign-in is the password first. After that, this device confirms it is you with your face or your fingerprint. An email code is the backup when neither one is available.

Until you turn this on, sign-in stays password only. After at least one device is enrolled, the password alone is not enough.

## Sign-in options

The three choices stay hidden until you open them.

Before you click **Sign-in options**, the screen shows one face icon and the line “Please remove anything that blocks your camera.” **Sign-in options** sits under that line. The face icon itself starts the camera check.

After you click **Sign-in options**, that reminder is replaced by the label **Sign-in options** and a row of three icons only:

1. Face
2. Fingerprint
3. Email code

There are no text labels on those icons. That row appears after the password, and each icon starts its own check.

## Face

The face icon opens the camera and looks for a face. The picture stays in the browser and is thrown away. The forum never receives it.

A covered camera fails this check and returns to the reminder above. Sign-in does not continue, and it does not fall through to a Windows PIN. Uncover the camera and use the face icon again, or open **Sign-in options** and choose fingerprint or email.

## Fingerprint

The fingerprint icon does not open the camera. Windows Hello asks for the fingerprint already saved on this device. A covered camera does not block this path.

The forum never receives a fingerprint image. It only checks that this device signed the login with the key created at enrollment.

## Email code

The envelope icon emails a 6-digit code to the same address you used for the password. It expires in 10 minutes.

The current email template still uses the subject **Reset your password**. The code is the 6-digit number in that message. Ignore the line that says one hour.

## What is stored

The server stores a public key for the device, not a photo and not a fingerprint. Windows Hello keeps the face and fingerprint on the device and compares them there.

## How it is saved

Right after the password on **Create an account**, three icons appear: fingerprint, face, and email. You choose at least one. That is the method used the next time you sign in.

- **Fingerprint** stores this device's public key. Windows asks for the fingerprint reader.
- **Face** checks the camera first, then stores the same kind of public key.
- **Email** records the account inbox. The next sign-in sends a code there.

The forum opens after one method is saved. There is no Face unlock page in the forum menu. The method is chosen when the account is created, and used again after the password.

The next sign-in asks for the password, then the camera reminder when a face or fingerprint is on the account. Open **Sign-in options** and pick the face, fingerprint, or email icon. An account that chose email only goes to the code after the password.

Use `http://localhost:5173`. WebAuthn will not run on `127.0.0.1`.







## Under the hood

Two different checks are stacked. The browser looks at the camera. Windows Hello then proves this device holds a private key. The server never sees a face or a fingerprint.

### Password, then a second token

`POST /api/auth/login` checks the email and the bcrypt password hash. If `webauthn_credentials` has no row for that user, the response is a normal forum JWT with `purpose: 'session'` (lifetime `JWT_EXPIRES_IN`, or one day).

If a device is enrolled, the response is `{ secondFactor, pendingToken, email }` and no session is stored. `pendingToken` is a JWT with `purpose: '2fa'`, the account id, name, and email. It expires in 5 minutes. Forum routes reject that purpose, so the pending token cannot open the dashboard. It is only accepted by the WebAuthn and email-code routes.

### Face icon: camera gate, then WebAuthn

The face icon calls `confirmLiveFace` in `frontend/src/pages/Auth/liveFace.js` before any WebAuthn call.

1. `getUserMedia` opens the user-facing camera. Frames stay in the page and are not uploaded.
2. `@mediapipe/tasks-vision` runs the BlazeFace short-range model (`public/models/blaze_face_short_range.tflite`) with the local WASM under `public/mediapipe`. The detector uses the CPU and a minimum confidence of 0.65.
3. About every 200 ms the page samples an 80×60 frame. The first 2 seconds of a dark image are ignored so a slow camera is not treated as covered. After that, average brightness below 18 for 8 frames in a row is a covered lens. The check stops and Windows Hello is never started.
4. Three frames in a row that contain a face pass. The whole wait is capped at 12 seconds.
5. The camera tracks are stopped and the page waits 400 ms so Windows can open the camera itself.

Only then does the browser call `POST /api/auth/webauthn/login/options` and `@simplewebauthn/browser` `startAuthentication`. The server options use relying party id `localhost`, origin `http://localhost:5173` (`WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN`), `userVerification: 'required'`, and the credential ids already stored for the account. A one-time challenge is written to `webauthn_challenges` with purpose `login` and a 5-minute expiry.

`POST /api/auth/webauthn/login/verify` loads that challenge, deletes it, and checks the assertion with `@simplewebauthn/server`. The signature must match the stored public key, the origin and rpId must match, and the user-verified flag must be set. The signature counter in `webauthn_credentials` is updated. Success returns the real session JWT, which the browser stores as `token` and `user`.

Windows Hello sets that user-verified flag for a face, a fingerprint, or a PIN. The flag does not say which one ran. The camera gate is what stops a covered lens from falling through to a PIN. The fingerprint icon skips the camera gate and goes straight to this same WebAuthn ceremony, so Windows can ask for the fingerprint reader.

### Enrollment

After registration the browser is signed in with a session token, then the three icons are shown. Face runs the camera gate, then `startRegistration`. Fingerprint calls `startRegistration` with no camera check. Email calls `POST /api/auth/email-signin`, which sets `users.email_signin`. Login returns the pending token when a credential row exists or `email_signin` is 1. Registration options ask for a platform authenticator on this device, with `userVerification: 'required'`, `residentKey: 'preferred'`, and `preferredAuthenticatorType: 'localDevice'`. Attestation is `none`, so the server does not collect a manufacturer certificate.

`POST /api/auth/webauthn/register/verify` checks the ceremony the same way and inserts one row into `webauthn_credentials`: credential id, user id, public key (`MEDIUMBLOB`), signature counter, and transports. The private key never leaves the device. Removing a device deletes that row. When the last row is gone and `email_signin` is still 0, login goes back to password only.

These register routes use the normal session token. The login routes use the pending token.

### Email code

The envelope calls `POST /api/auth/webauthn/email-code` with the pending token. The server draws a 6-digit code with `crypto.randomInt`, stores only its SHA-256 hash in `login_email_codes`, and marks any older unused code for that user as used. The row expires in 10 minutes. Five wrong guesses mark it used.

EmailJS sends it through the password-reset template. The template subject is still the fixed line “Reset your password”, and the body still contains the starter sentence about one hour. The code sentence is placed in `{{link}}` and `{{message}}` so the digits show in that message. The plain code is not written to the database or the server log on purpose.

`POST /api/auth/webauthn/email-code/verify` hashes the typed digits and compares them to `code_hash`. A match marks the row used and returns the session JWT.

### Tables

| Table | What it holds |
| --- | --- |
| `webauthn_credentials` | Device public key, credential id, counter, transports |
| `webauthn_challenges` | Single-use register or login challenge, 5 minutes |
| `login_email_codes` | SHA-256 of the email code, attempt count, 10-minute expiry |
| `users.email_signin` | 1 when email was the method chosen at account creation |

`schema.sql` includes the same tables and column. On a database that already exists, apply `backend/db/migrations/002-webauthn.sql` and `backend/db/migrations/003-email-signin.sql` instead of running `schema.sql`, because `schema.sql` drops every table.
