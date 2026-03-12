# Sri Ram Fashions App

A comprehensive, full-stack business management application for "Sri Ram Fashions" built with React Vite (frontend) and Express.js/MongoDB (backend).

## 🚀 Features

- **🔐 Authentication**: Email/password login, Phone OTP verification, Social login buttons
- **📊 Dashboard**: Real-time stats, revenue charts, inventory overview, recent bills
- **🧾 Billing System**: Create bills, A4 format preview, print/PDF export, GST calculations
- **📦 Inventory Management**: Stock tracking, low stock alerts, category management
- **📈 Reports & Analytics**: Sales trends, top products, category performance, Excel export
- **⚙️ Settings**: Company info, bank details, tax configuration, theme customization

## 🎨 Theme Options

8 beautiful color themes with light/dark mode support:
- Royal Purple, Ocean Blue, Tropical Teal, Forest Green
- Sunset Orange, Bloom Pink, Rose Red, Deep Indigo

## 📁 Project Structure

```
sri-ram-fashion-app/
├── frontend/                 # React Vite Frontend
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── contexts/        # React contexts
│   │   ├── services/        # API services
│   │   ├── utils/           # Utility functions
│   │   └── types/           # TypeScript types
│   └── package.json
│
├── backend/                  # Express.js Backend
│   ├── src/
│   │   ├── models/          # Mongoose models
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Express middleware
│   │   └── index.js         # Server entry
│   └── package.json
│
└── README.md
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB (local or Atlas)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

### Backend Setup

```bash
cd backend
npm install

# Copy and edit backend/.env.example:
# cp .env.example .env
#
# Required variables:
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/sri-ram-fashions
# JWT_SECRET=your-secret-key
#
# Optional but recommended:
# GOOGLE_CLIENT_ID=your-google-client-id
# BOOTSTRAP_DEFAULT_ADMIN=false
#
# Email delivery (choose one)
# RESEND_API_KEY=your_resend_api_key
# RESEND_FROM=Sri Ram Fashions <no-reply@yourdomain.com>
# ADMIN_EMAIL=owner@yourdomain.com
#
# or Gmail SMTP fallback
# EMAIL_USER=your_gmail_address
# EMAIL_PASS=your_gmail_app_password
# EMAIL_FROM=Sri Ram Fashions <your_gmail_address>

npm run dev
```

Backend runs at: http://localhost:5000

### Email Setup

Manual email actions in the dashboard, billing, purchase billing, and report pages use the backend email service.

Use one of these configurations in `backend/.env`:

- `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_EMAIL`
- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, `ADMIN_EMAIL`

Notes:

- `ADMIN_EMAIL` is used for scheduled alerts and as a fallback recipient.
- Manual email actions now also default to the logged-in user's email when available.
- Restart the backend after changing email env values.

### Google Login Setup (Fix for `Error 400: invalid_request`)

Use a Google OAuth **Web application** client ID.

1. Open Google Cloud Console -> APIs & Services -> Credentials.
2. Create or edit an OAuth Client ID of type **Web application**.
3. Add Authorized JavaScript origins:
   - `http://localhost:5173`
   - your deployed frontend origin (for example `https://sri-ram-fashions.onrender.com`)
4. Put the same client ID in:
   - `frontend-new/.env` as `VITE_GOOGLE_CLIENT_ID`
   - `backend/.env` as `GOOGLE_CLIENT_ID` (or `GOOGLE_CLIENT_IDS` for multiple IDs)
5. Restart frontend and backend after updating env values.

## 📱 Pages

| Page | Description |
|------|-------------|
| `/login` | Login page with social and OTP options |
| `/` | Dashboard with stats and charts |
| `/billing` | Bill management and creation |
| `/inventory` | Stock and product management |
| `/reports` | Analytics and reports |
| `/settings` | App configuration |

## 🔧 Tech Stack

### Frontend
- React 18 + Javascript 
- Vite
- React Router v6
- Recharts (charts)
- Lucide React (icons)
- Axios (HTTP client)

### Backend
- Express.js
- MongoDB + Mongoose
- JWT Authentication
- bcryptjs

## 📄 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/send-otp` | Send OTP |
| GET | `/api/products` | Get all products |
| POST | `/api/bills` | Create bill |
| GET | `/api/reports/sales-trend` | Get sales data |
| GET | `/api/settings` | Get settings |

> Security note: All business APIs now require `Authorization: Bearer <JWT>` except `/api/auth/*` and `/api/health`.

## 🎯 Demo Login

For testing without backend:
- Any email/password works (mock auth)
- Phone OTP: Use `123456` as OTP

## 📝 License

MIT License - Sri Ram Fashions
