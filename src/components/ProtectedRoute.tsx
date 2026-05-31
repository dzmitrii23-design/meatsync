import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, UserRole } from '../authStore';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  // Если не авторизован -> перенаправляем на экран логина
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Если роль пользователя отличается от разрешенных роли -> показываем отказ в доступе
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div id="access-denied-container" className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
        <div id="access-denied-card" className="max-w-md w-full bg-white border border-red-100 rounded-2xl shadow-xl p-8 text-center animate-in fade-in duration-200">
          <div id="icon-wrapper" className="mx-auto w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 ring-8 ring-red-100">
            <ShieldAlert size={32} />
          </div>
          
          <h2 id="access-denied-title" className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
            Доступ запрещен
          </h2>
          
          <p id="access-denied-description" className="text-sm text-gray-500 mb-6 leading-relaxed">
            Извините, у вашего аккаунта с ролью <strong className="text-gray-700 font-semibold">{user.role}</strong> недостаточно прав для просмотра данного раздела приложения. Обратитесь к администратору системы.
          </p>

          <button
            id="back-button"
            onClick={() => window.history.back()}
            className="w-full py-3 px-4 inline-flex justify-center items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
          >
            <ArrowLeft size={16} />
            Назад
          </button>
        </div>
      </div>
    );
  }

  // Если всё хорошо -> рендерим дочерние элементы или дочерний роут
  return children ? <>{children}</> : <Outlet />;
}
