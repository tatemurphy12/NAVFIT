# SSN Encryption

NAVFIT26 supports optional password-based encryption of SSN fields stored in the SQLite database. The toggle is accessible from the opened database view on the Home Page.

---

## Enabling Encryption

1. On the Home Page, click a database to open it.
2. Click the **Encrypt SSNs** button.
3. If this is the first time encrypting this database, enter and confirm a password. Otherwise, enter the existing password.
4. All SSN fields in the database are encrypted in place. The button label changes to **Decrypt SSNs**.

> Store your password securely. There is no recovery mechanism if the password is lost.

---

## Decrypting

1. Open the database from the Home Page.
2. Click the **Decrypt SSNs** button.
3. Enter the password. All SSN fields are decrypted in place.

---

## Masked Display

While a database is encrypted, SSN fields in the FITREP form are shown as bullet characters (`••••••••••`) and are read-only. All other fields remain editable.

---

## Effect on Exports

| Export type | Encrypted database behavior |
|---|---|
| PDF | Exports with SSN fields shown as asterisks |
| ACCDB | Blocked — a password prompt appears; entering the correct password decrypts and then immediately exports |

The ACCDB decrypt-and-export flow can be triggered from either the Home Page (via the Export ACCDB button in the opened database view) or from within the FITREP form.

---

## Security Notes

- Encryption is applied at the field level — only SSN column values are encrypted, not the database file itself.
- For full file-level protection, consider OS-level disk encryption (BitLocker on Windows, LUKS on Linux).
