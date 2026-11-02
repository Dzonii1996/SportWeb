import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login  from "./pages/Login";
import Register  from "./pages/Registration";
import Navbar from "./pages/NavBar";
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
function App() {

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
        <Route path="/my-matches" element={<MyMatches />} />
        <Route path="/matches/:id" element={<MatchDetails />} />
        <Route path="/matches/:id/edit" element={<EditMatch />} />
        <Route path="/profile" element={<Profile />} />
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


      

    </BrowserRouter>
  )
}


export default App;