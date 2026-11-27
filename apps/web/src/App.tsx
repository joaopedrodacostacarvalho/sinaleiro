import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './auth/AuthContext';
import { Login } from './pages/Login';
import { Home } from './pages/Home';

function App() {

  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  return user ? <Home /> : <Login />
}

export default App
