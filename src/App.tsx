import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@shared/contexts/AuthContext'
import { ErrorBoundary } from '@shared/components/ErrorBoundary'
import { MainApp } from '@apps/main/MainApp'
import { SgApp } from '@apps/sg/SgApp'
import '@shared/theme/global.css'

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/sg/*" element={<SgApp />} />
            <Route path="/*" element={<MainApp />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
