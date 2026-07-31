import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login  from "./pages/Login";
import Register  from "./pages/Registration";
import Navbar from "./pages/NavBar";
import MatchCard from "./components/MatchCard";
import Matches from "./pages/Matches";
import CreateMatch from "./pages/CreateMatche";
import ProtectedRoute from "./components/ProtectedRoute";
function App() {

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>

        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/matches" element={<Matches />} />
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