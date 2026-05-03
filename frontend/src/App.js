import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import ChatPage from './pages/AdminPge/ChatPage/ChatPage';
import HistoryPage from './pages/AdminPge/HistoryPage/HistoryPage';
import StatisticsPage from './pages/AdminPge/StatisticsPage/StatisticsPage';
import SettingsPage from './pages/AdminPge/SettingsPage/SettingsPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import PatientLayout from './components/LayoutPatient/PatientLayout/PatientLayout';
import PatientInfo from './pages/PatientPage/PatientInfo/PatientInfo';
import PatientHistory from './pages/PatientPage/PatientHistory/PatientHistory';
import PatientESO from './pages/PatientPage/PatientESO/PatientESO';
import PatientChat from './pages/PatientPage/PatientChat/PatientChat';
import PatientSettings from './pages/PatientPage/PatientSettings/PatientSettings';
import PrivateRoute from './components/PrivateRoute';
import PublicHomePage from './pages/PublicPage/PublicHomePage/PublicHomePage';
import PublicChatPage from './pages/PublicPage/PublicChatPage/PublicChatPage';
import PublicAboutPage from './pages/PublicPage/PublicAboutPage/PublicAboutPage';
import PublicSettingsPage from './pages/PublicPage/PublicSettingsPage/PublicSettingsPage';
import PublicHistoryPage from './pages/PublicPage/PublicHistoryPage/PublicHistoryPage';
import ContactPage from './pages/AdminPge/ContactPage/ContactPage';
import './App.css';

function App() {
  const role = localStorage.getItem('userRole');
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <BrowserRouter>
      <Routes>
        {/* Routes publiques */}
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/public/home" element={<PublicHomePage />} />
        <Route path="/public/chat" element={<PublicChatPage />} />
        <Route path="/public/about" element={<PublicAboutPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/public/settings" element={<PublicSettingsPage />} />
        <Route path="public/history" element={<PublicHistoryPage />} />

        {/* Routes patient protégées */}
        <Route path="/patient/chat" element={
          <PrivateRoute allowedRoles={['patient']}>
            <PatientLayout><PatientChat /></PatientLayout>
          </PrivateRoute>
        } />
        <Route path="/patient/info" element={
          <PrivateRoute allowedRoles={['patient']}>
            <PatientLayout><PatientInfo /></PatientLayout>
          </PrivateRoute>
        } />
        <Route path="/patient/history" element={
          <PrivateRoute allowedRoles={['patient']}>
            <PatientLayout><PatientHistory /></PatientLayout>
          </PrivateRoute>
        } />
        <Route path="/patient/eso" element={
          <PrivateRoute allowedRoles={['patient']}>
            <PatientLayout><PatientESO /></PatientLayout>
          </PrivateRoute>
        } />
        <Route path="/patient/settings" element={
          <PrivateRoute allowedRoles={['patient']}>
            <PatientLayout><PatientSettings /></PatientLayout>
          </PrivateRoute>
        } />

        {/* Routes manager protégées */}
        <Route path="/manager/dashboard" element={
          <PrivateRoute allowedRoles={['manager']}>
            <Layout><StatisticsPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/manager/chat" element={
          <PrivateRoute allowedRoles={['manager']}>
            <Layout><ChatPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/manager/history" element={
          <PrivateRoute allowedRoles={['manager']}>
            <Layout><HistoryPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/manager/settings" element={
          <PrivateRoute allowedRoles={['manager']}>
            <Layout><SettingsPage /></Layout>
          </PrivateRoute>
        } />
   
        <Route path="/manager/contacts" element={
          <PrivateRoute allowedRoles={['manager']}>
            <Layout><ContactPage /></Layout>
          </PrivateRoute>
        } />

        {/* Redirection par défaut */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;