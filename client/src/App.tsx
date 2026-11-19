import { ThemeProvider } from './context/ThemeContext';
import { OccupancyPage } from './pages/OccupancyPage';

export function App() {
  return (
    <ThemeProvider>
      <OccupancyPage />
    </ThemeProvider>
  );
}

export default App;
