import { createBrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Signup from "./components/Signup";
import Signin from "./components/Signin";
import Dashboard from "./components/Dashboard";
import ModuleTree from "./components/ModuleTree";
import Insights from "./components/SentAnalysis/Insights"
import LecturerPage from "./components/SentAnalysis/LecturerPage";
import ProfilePage from "./components/ProfilePage";
import GPACalculator from "./components/GPACalculator";

export const router = createBrowserRouter([
    {path: "/", element: <Navigate to="/signin" replace />},
    {path: "/signup", element: <Signup />},
    {path: "/signin", element: <Signin />},
    {path: "/dashboard", element: <ProtectedRoute><Dashboard /></ProtectedRoute>},
    {path: "/moduleTree", element: <ProtectedRoute><ModuleTree /></ProtectedRoute>},
    {path: "/insights", element: <ProtectedRoute><Insights /></ProtectedRoute>},
    {path: "/insights/:moduleCode", element: <ProtectedRoute><Insights /></ProtectedRoute>},
    {path: "/professor/:name", element: <ProtectedRoute><LecturerPage /></ProtectedRoute>},
    {path: "/profilePage", element: <ProtectedRoute><ProfilePage /></ProtectedRoute>},
    {path: "/gpaCalculator", element: <ProtectedRoute><GPACalculator /></ProtectedRoute>}
]);