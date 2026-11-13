import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Home from "./pages/Home";
import Login  from "./pages/Login";
import Register  from "./pages/Registration";
import Navbar from "./pages/NavBar";
import BottomNav from "./components/BottomNav";
import MatchCard from "./components/MatchCard";
import Matches from "./pages/Matches";
import CreateMatch from "./pages/CreateMatche";
import ProtectedRoute from "./components/ProtectedRoute";
import MyMatches from "./pages/MyMatches";
import EditMatch from "./pages/EditMatch";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import MatchDetails from "./pages/MatchDetails";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Leaderboard from "./pages/Leaderboard";
import Gallery from "./pages/Gallery";
import Venues from "./pages/Venues";
import VenueDetails from "./pages/VenueDetails";
import VenueForm from "./pages/VenueForm";
import VenueAdmin from "./pages/VenueAdmin";
import Reservations from "./pages/Reservations";
import Tournaments from "./pages/Tournaments";
import TournamentDetails from "./pages/TournamentDetails";
import TournamentForm from "./pages/TournamentForm";
import TournamentInvite from "./pages/TournamentInvite";
function App() {
  // Promena jezika ponovo iscrtava celu aplikaciju, pa i tekstove iz pomoćnih funkcija
  useTranslation();

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>

        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/rang-lista" element={<Leaderboard />} />
        <Route path="/galerija" element={<Gallery />} />
        <Route path="/tereni" element={<Venues />} />
        <Route
          path="/tereni/predlozi"
          element={<ProtectedRoute><VenueForm /></ProtectedRoute>}
        />
        <Route
          path="/tereni/admin"
          element={<ProtectedRoute><VenueAdmin /></ProtectedRoute>}
        />
        <Route path="/turniri" element={<Tournaments />} />
        <Route
          path="/turniri/novi"
          element={<ProtectedRoute><TournamentForm /></ProtectedRoute>}
        />
        <Route path="/turniri/pozivnica/:token" element={<TournamentInvite />} />
        <Route path="/turniri/:id" element={<TournamentDetails />} />
        <Route
          path="/turniri/:id/izmeni"
          element={<ProtectedRoute><TournamentForm /></ProtectedRoute>}
        />
        <Route
          path="/rezervacije"
          element={<ProtectedRoute><Reservations /></ProtectedRoute>}
        />
        <Route path="/tereni/:id" element={<VenueDetails />} />
        <Route
          path="/tereni/:id/izmeni"
          element={<ProtectedRoute><VenueForm /></ProtectedRoute>}
        />
        <Route path="/my-matches" element={<ProtectedRoute><MyMatches /></ProtectedRoute>} />
        <Route path="/matches/:id" element={<MatchDetails />} />
        <Route path="/matches/:id/edit" element={<ProtectedRoute><EditMatch /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/users/:id" element={<PublicProfile />} />
<Route 
  path="/create-match"
  element={
    <ProtectedRoute>
      <CreateMatch />
    </ProtectedRoute>
  }
/>
      </Routes>
      <BottomNav />


      

    </BrowserRouter>
  )
}


export default App;