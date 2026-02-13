# Dental Flow - Dental Clinic Management System
(نظام إدارة عيادات الأسنان المتكامل)

![Dental Flow Logo](public/icon.ico)

**Dental Flow** is a professional, offline-first desktop application engineered for modern dental clinics. It combines powerful patient management, financial tracking, and smart scheduling into a secure, high-performance platform that works seamlessly without consistent internet access.

**دينتال فلو** هو تطبيق سطح مكتب احترافي مصمم لعيادات الأسنان الحديثة. يجمع بين إدارة المرضى المتقدمة، التتبع المالي، والجدولة الذكية في منصة آمنة وعالية الأداء تعمل بكفاءة تامة حتى بدون اتصال دائم بالإنترنت.

---

## 🚀 Key Features (الميزات الرئيسية)

### 1. 🏥 Patient Management (إدارة المرضى)
*   **Comprehensive Profiles**: Manage demographics, medical history, and visits.
*   **Active Treatment Plans**: Track multiple treatment courses per patient.
*   **Offline Access**: Instant access to all records locally.
*   **ملفات شاملة**: إدارة البيانات الشخصية، التاريخ الطبي، والزيارات.
*   **خطط العلاج**: تتابع مراحل العلاج المتعددة لكل مريض بدقة.

### 2. 📅 Smart Scheduling (إدارة المواعيد)
*   **Visual Calendar**: Drag-and-drop appointment management.
*   **Status Workflow**: Track lifecycle (Scheduled → Attended → Completed).
*   **Dashboard**: Instant daily overview of appointments and revenue.
*   **تقويم مرئي**: إدارة المواعيد بالسحب والإفلات.
*   **لوحة تحكم**: نظرة عامة فورية على مواعيد اليوم والإيرادات.

### 3. 💰 Financial System (النظام المالي)
*   **Invoicing & Payments**: Create invoices, track partial payments, and manage debts.

*   **Doctor Commissions**: Automated calculation (Percentage or Fixed) per doctor.
*   **Expense Tracking**: Monitor clinic expenses and operational costs.
*   **Profit Calculation**: Auto-calculate net profit based on revenue vs. expenses (including lab costs).
*   **فواتير ومدفوعات**: إنشاء فواتير، متابعة الدفعات الجزئية، وإدارة الديون.
*   **عمولات الأطباء**: حساب آلي للعمولات (نسبة أو مبلغ ثابت) لكل طبيب.
*   **حساب الأرباح**: حساب تلقائي للأرباح الصافية بناءً على الإيرادات، المصروفات، وتكاليف المعمل.

### 4. 🦷 Lab Management (إدارة المعامل)
*   **Lab Orders**: Track prosthetics and appliance orders sent to labs.
*   **Status Tracking**: Monitor order workflow (Sent → Received).
*   **Financials**: Record lab expenses and manage payments to labs.
*   **طلبات المعمل**: متابعة التركيبات والطلبات المرسلة للمعامل.
*   **تتبع الحالة**: مراقبة حالة الطلب (مرسل → مستلم).
*   **الماليات**: تسجيل تكاليف المعمل وإدارة الدفعات المستحقة.

### 5. 📦 Stock Management (إدارة المخزن)
*   **Inventory Tracking**: Monitor stock levels for medical supplies and items.
*   **Low Stock Alerts**: Visual indicators when items fall below minimum quantity.
*   **Movement History**: Track additions and deductions with reasons for every change.
*   **تتبع المخزون**: مراقبة مستويات المخزون للمستلزمات الطبية.
*   **تنبيهات النقص**: مؤشرات بصرية عند انخفاض الكميات عن الحد الأدنى.
*   **سجل الحركات**: تتبع الإضافات والخصومات مع ذكر الأسباب لكل عملية.


### 6. ☁️ Secure Backup (النسخ الاحتياطي)
*   **Hybrid Strategy**: Supports both **Local** and **Cloud (Google Drive)** backups.
*   **Encryption**: Optional AES-256 encryption for backups.
*   **Single-File Restore**: Simplified recovery process with integrity checks.
*   **نظام هجين**: يدعم النسخ المحلي والسحابي (Google Drive).
*   **التشفير**: خيار تشفير النسخ الاحتياطية لضمان الخصوصية.

### 7. 🔐 Security & Access Control (الأمان والتحكم)
*   **PIN Login**: Fast, secure access for daily use.
*   **User Management**: Admin can manage users, roles, and reset PINs.
*   **Change PIN**: Users can securely change their own PINs.
*   **Anti-Tampering**: Detects clock manipulation to prevent fraud.
*   **دخول برمز PIN**: وصول سريع وآمن.
*   **إدارة المستخدمين**: يمكن للمدير إدارة الموظفين وإعادة تعيين كلمات المرور.
*   **تغيير الرمز**: يمكن للمستخدمين تغيير الرمز السري الخاص بهم بأمان.

---

## 🛡️ Licensing System (نظام الترخيص)

Dental Flow employs a robust **Device-Locked Offline Licensing** system designed to protect intellectual property while ensuring ease of use for the clinic.

يستخدم النظام **آلية ترخيص مغلقة (Device-Locked)** لحماية حقوق الملكية الفكرية مع ضمان سهولة الاستخدام للعيادة وتعمل دون الحاجة لاتصال دائم بالإنترنت.

### License States (حالات الرخصة)
1.  **Active (نشطة)**:
    *   Full system functionality.
    *   البرنامج يعمل بكامل كفاءته.
2.  **Grace Period (فترة سماح)**:
    *   **7 Days** after expiration.
    *   System works but shows daily warnings.
    *   **7 أيام** بعد انتهاء الصلاحية، يعمل النظام مع تنبيهات يومية.
3.  **Expired/Invalid (منتهية/غير صالحة)**:
    *   System enters **Read-Only Mode**.
    *   Data is accessible/exportable, but no new records can be added or edited.
    *   يدخل النظام في وضع **القراءة فقط** (يمكن الاطلاع على البيانات وتصديرها، لا يمكن التعديل).

### Security Mechanisms (آليات الحماية)
*   **Device Fingerprinting**: The license is bound to the hardware signature of the PC. Moving the database to another device invalidates the license.
*   **بصمة الجهاز**: يتم ربط الرخصة بتوقيع الجهاز (Hardware ID). نقل قاعدة البيانات لجهاز آخر يبطل الرخصة.
*   **Anti-Backdating**: The system records the last usage time. Setting the OS clock back in time triggers a security lock (`CLOCK_TAMPERED`).
*   **منع التلاعب بالتاريخ**: النظام يسجل آخر وقت استخدام. إرجاع ساعة الجهاز للوراء يؤدي لإغلاق النظام أمنياً.

---

## 🛠️ Tech Stack (التقنيات المستخدمة)

*   **Runtime**: [Electron](https://www.electronjs.org/) (Chromium + Node.js)
*   **Frontend**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [TailwindCSS](https://tailwindcss.com/) + [Shadcn/UI](https://ui.shadcn.com/)
*   **Database**: [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) (High-performance local DB)
*   **Cloud Integration**: [Google Drive API](https://developers.google.com/drive) (For backups)
*   **Build System**: [Vite](https://vitejs.dev/) + [Electron-Builder](https://www.electron.build/)

---

## 🏁 Installation & Development

### Prerequisites
*   Node.js (v18+)
*   NPM or Yarn

### Steps

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Run in Development Mode**
    ```bash
    npm run dev
    ```

3.  **Build for Production (Windows)**
    ```bash
    npm run build
    ```
    *Output will be in the `release` folder.*


---

## 📜 Database Overview (نظرة على التخزين)

The system uses a strictly localized relational database schema ensuring **Data Isolation** (Multi-Tenancy ready).
يعتمد النظام على هيكل قاعدة بيانات علائقية محلية يضمن **عزل البيانات**.

*   **`clinics`**: Stores clinic metadata (Name, Currency, Owner).
*   **`users`**: Secure storage for operators (Doctors/Staff) and their hashed PINs.
*   **`patients`**: Core patient registry linked to the clinic.
*   **`treatments` & `invoices`**: Transactional records linked via Foreign Keys.
*   **`app_meta`**: A key-value store for system state, license tokens, and configuration.

---

*© 2024-2026 Code of Duty. All rights reserved.*
*Made with ❤️ for Dentists.*

