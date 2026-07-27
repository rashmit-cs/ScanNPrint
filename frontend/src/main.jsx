import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import './index.css'
import HelpButton from './components/HelpButton.jsx'

import LandingPage             from './pages/LandingPage.jsx'
import LoginPage               from './pages/LoginPage.jsx'
import SignupPage              from './pages/SignupPage.jsx'
import ForgotPasswordPage      from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage       from './pages/ResetPasswordPage.jsx'
import VerifyEmailPage         from './pages/VerifyEmailPage.jsx'
import PlanSelectPage          from './pages/PlanSelectPage.jsx'
import PendingApprovalPage     from './pages/PendingApprovalPage.jsx'
import JoinWhatsAppPage        from './pages/JoinWhatsAppPage.jsx'
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage.jsx'
import UpgradePage             from './pages/UpgradePage.jsx'
import DashboardPage           from './pages/DashboardPage.jsx'
import SetupPage               from './pages/SetupPage.jsx'
import CustomerPage            from './pages/CustomerPage.jsx'
import ShopPolicyPage          from './pages/ShopPolicyPage.jsx'
import OrderStatusPage         from './pages/OrderStatusPage.jsx'
import SessionStatusPage       from './pages/SessionStatusPage.jsx'
import AdminPage               from './pages/AdminPage.jsx'
import PrivacyPage             from './pages/PrivacyPage.jsx'
import TermsPage               from './pages/TermsPage.jsx'
import HelpPage                from './pages/HelpPage.jsx'

// Shopkeeper-facing pages only — hidden on the landing page, auth pages, legal pages,
// and the customer-facing QR/upload/status pages (a customer printing a document
// shouldn't see "WhatsApp Support" meant for shop owners).
function ShopkeeperHelpButton() {
  const { pathname } = useLocation()
  const hidden = ['/', '/login', '/signup', '/privacy', '/terms'].includes(pathname)
    || pathname.startsWith('/shop/') || pathname.startsWith('/order/') || pathname.startsWith('/session/')
  return hidden ? null : <HelpButton />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ShopkeeperHelpButton />
    <Routes>
      <Route path="/"                      element={<LandingPage />} />
      <Route path="/login"                 element={<LoginPage />} />
      <Route path="/signup"               element={<SignupPage />} />
      <Route path="/forgot-password"       element={<ForgotPasswordPage />} />
      <Route path="/reset-password"        element={<ResetPasswordPage />} />
      <Route path="/verify-email"          element={<VerifyEmailPage />} />
      <Route path="/select-plan"           element={<PlanSelectPage />} />
      <Route path="/pending-approval"      element={<PendingApprovalPage />} />
      <Route path="/join-whatsapp"         element={<JoinWhatsAppPage />} />
      <Route path="/subscription-expired"  element={<SubscriptionExpiredPage />} />
      <Route path="/upgrade"               element={<UpgradePage />} />
      <Route path="/dashboard"             element={<DashboardPage />} />
      <Route path="/setup"                 element={<SetupPage />} />
      <Route path="/shop/:shopId"          element={<CustomerPage />} />
      <Route path="/shop/:shopId/policies" element={<ShopPolicyPage />} />
      <Route path="/order/:orderId"        element={<OrderStatusPage />} />
      <Route path="/session/:sessionId"    element={<SessionStatusPage />} />
      <Route path="/admin"                 element={<AdminPage />} />
      <Route path="/privacy"               element={<PrivacyPage />} />
      <Route path="/terms"                 element={<TermsPage />} />
      <Route path="/help"                  element={<HelpPage />} />
    </Routes>
  </BrowserRouter>
)