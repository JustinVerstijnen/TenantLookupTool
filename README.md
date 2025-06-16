# Microsoft 365 Tenant Lookup Tool

The **Tenant Lookup Tool** is a lightweight web application that lets you retrieve Microsoft 365 tenant details using a custom domain or MOERA (Microsoft Online Email Routing Address) domain.

Simply enter a domain name (e.g., `example.com`) and the tool will return key tenant information including the **Tenant ID**, **Issuer URL**, and the **geographic region** where the tenant is hosted.

---

## 🔍 Features

- ✨ Sleek, responsive user interface
- 🔐 Uses public Microsoft identity endpoints (OpenID configuration)
- 🌍 Detects hosting region (e.g., Global, US Gov, China, Germany)
- ⚡ Instant results with animated feedback
- 🧠 Smart input validation

---

## 🚀 Live Demo

You can try the tool live at: [tenantlookuptool.jvapp.nl](https://tenantlookuptool.jvapp.nl)

---

## 🧪 How It Works

1. The user enters a domain name.
2. The app constructs a query to:
   ```
   https://login.microsoftonline.com/<domain>/v2.0/.well-known/openid-configuration
   ```
3. If the domain is valid and linked to a Microsoft tenant, the response is parsed to extract:
   - **Tenant ID**
   - **Issuer URL**
   - **Authorization endpoint**
   - **Region**

---

## 🛠️ Project Structure

```
TenantLookupTool/
├── index.html       # Main UI structure
├── script.js        # JavaScript logic for lookup and UI rendering
├── styles.css       # Styling and animations
```

---

## 📸 Example Output

```plaintext
Tenant Information:
──────────────────────────────
Custom domain:     example.com
Tenant ID:         abcdefgh-1234-ijkl-5678-mnopqrstuvwx
Location:          Global (Worldwide)
Issuer:            https://login.microsoftonline.com/abcdefgh-1234-ijkl-5678-mnopqrstuvwx/v2.0
```
---

## 🙌 Credits

Created by [Justin Verstijnen](https://justinverstijnen.nl)  
Logo and branding courtesy of the developer's personal brand.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
