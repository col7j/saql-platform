import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, MorePage } from './layout/AppShell';
import PublicHome from './pages/public/Home';
import Login from './pages/public/Login';
import TrackingPage from './pages/public/Tracking';
import Dashboard from './pages/app/Dashboard';
import CalendarPage from './pages/app/Calendar';
import NotificationsPage from './pages/app/Notifications';
import TripsPage from './pages/app/Trips';
import TripDetail from './pages/app/trip/TripDetail';
import FocusPage from './pages/app/Focus';
import FocusDetail from './pages/app/FocusDetail';
import IndividualPage from './pages/app/Individual';
import PlansPage, { PlanOf } from './pages/app/Plans';
import SurveysPage from './pages/app/Surveys';
import LibraryPage from './pages/app/Library';
import GroupsPage from './pages/app/Groups';
import PersonPage from './pages/app/Person';
import LeaderboardPage from './pages/app/Leaderboard';
import TrackerPage from './pages/app/Tracker';
import TasksPage from './pages/app/Tasks';
import CommitteesPage, { CommitteeDetail } from './pages/app/Committees';
import PeoplePage from './pages/app/People';
import FinancePage from './pages/app/Finance';
import RequestsPage from './pages/app/Requests';
import MeetingsPage, { MeetingDetail } from './pages/app/Meetings';
import InsightsPage from './pages/app/Insights';
import MessagesPage from './pages/app/Messages';
import ApprovalsPage from './pages/app/Approvals';
import AuditPage from './pages/app/Audit';
import TrackingLinkAdmin from './pages/app/TrackingLinkAdmin';
import SiteEditor from './pages/app/SiteEditor';
import SettingsPage from './pages/app/Settings';
import ProfilePage from './pages/app/Profile';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/supporter" element={<TrackingPage />} />
        <Route path="/t/:token" element={<Navigate to="/supporter" replace />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/:id" element={<TripDetail />} />
          <Route path="focus" element={<FocusPage />} />
          <Route path="focus/:id" element={<FocusDetail />} />
          <Route path="individual" element={<IndividualPage />} />
          <Route path="plan" element={<Navigate to="/app/plans" replace />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="plans/:id" element={<PlanOf />} />
          <Route path="surveys" element={<SurveysPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="people/:id" element={<PersonPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="tracker" element={<TrackerPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="committees" element={<CommitteesPage />} />
          <Route path="committees/:id" element={<CommitteeDetail />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="custody" element={<Navigate to="/app/requests" replace />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="meetings/:id" element={<MeetingDetail />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="contact" element={<Navigate to="/app/messages" replace />} />
          <Route path="inbox" element={<Navigate to="/app/messages" replace />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="tracking-link" element={<TrackingLinkAdmin />} />
          <Route path="site-editor" element={<SiteEditor />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<Navigate to="/app/people" replace />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
