import React, { useState } from 'react';
import { Nomenclature } from './components/Nomenclature';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Locations } from './components/Locations';
import { Journal } from './components/Journal';
import { Returns } from './components/Returns';
import { useAppStore } from './store';
import { Box, LayoutDashboard, Database, ArrowLeftRight, Settings, FileClock, RotateCcw, AlertTriangle } from 'lucide-react';
import { AiAssistantPanel } from './components/AiAssistantPanel';

type Tab = 'dashboard' | 'nomenclature' | 'transactions' | 'locations' | 'journal' | 'returns';

export default function App() {
  const { 
    state, 
    loading,
    isOnline,
    unsyncedCount,
    dataWarning,
    runIntegrityFix,
    isLocalServerConnected,
    addProduct, 
    updateProduct, 
    deleteProduct,
    clearProducts,
    importManyProducts,
    processIncome,
    processOutcome,
    moveBatch,
    addBuyer,
    updateBuyer,
    deleteBuyer,
    processReturn,
    deleteTransaction,
    updateTransaction
  } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [role, setRole] = useState<'ADMIN' | 'VIEWER'>(() => {
    // По умолчанию новые устройства открывают отчеты (только чтение)
    return (localStorage.getItem('user_role') as 'ADMIN' | 'VIEWER') || 'VIEWER';
  });

  const handleToggleRole = () => {
    if (role === 'ADMIN') {
      setRole('VIEWER');
      localStorage.setItem('user_role', 'VIEWER');
      setActiveTab('dashboard'); // Возврат на безопасную вкладку отчетов
    } else {
      const pass = prompt('Введите пароль Администратора для разблокировки функций управления:');
      if (pass === 'admin2026') {
        setRole('ADMIN');
        localStorage.setItem('user_role', 'ADMIN');
      } else if (pass !== null) {
        alert('Неверный пароль доступа!');
      }
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {/* Universal Top Header Panel */}
      <header className="bg-slate-950 text-slate-300 border-b border-slate-900 z-30 shrink-0 shadow-md print:hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-8 py-3.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          
          {/* Logo / Brand & Administrator Badge */}
          <div className="flex items-center justify-between xl:justify-start gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <Box className="w-7 h-7 text-blue-500 shrink-0" />
              <div>
                <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">
                  MeatSync
                </h1>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold font-mono leading-none mt-0.5">
                  Система учета мяса
                </p>
              </div>
            </div>
            
            {/* Unified Operator Badge */}
            <button 
              onClick={handleToggleRole}
              className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 transition-colors cursor-pointer select-none"
              title={role === 'ADMIN' ? 'Кликните, чтобы перейти в режим просмотра отчетов' : 'Кликните, чтобы ввести пароль Администратора'}
            >
              <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold text-[8px] font-mono shrink-0 select-none ${
                role === 'ADMIN' 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/25' 
                  : 'bg-slate-800 text-slate-500 border border-slate-700'
              }`}>
                {role === 'ADMIN' ? 'AD' : 'VW'}
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                {role === 'ADMIN' ? 'Администратор' : 'Наблюдатель (Только отчеты)'}
              </span>
            </button>

            {/* Connection Sync Badge */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all duration-300 select-none ${
              !isLocalServerConnected
                ? 'bg-rose-950/40 text-rose-400 border-rose-500/20'
                : isOnline 
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]' 
                  : 'bg-amber-950/40 text-amber-400 border-amber-500/20'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                !isLocalServerConnected 
                  ? 'bg-rose-500 animate-pulse' 
                  : isOnline 
                    ? 'bg-emerald-500 animate-pulse' 
                    : 'bg-amber-500'
              }`} />
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {!isLocalServerConnected
                  ? '❌ Сервер отключен'
                  : loading 
                    ? 'Синхронизация...' 
                    : isOnline 
                      ? '🛜 Облако (Supabase)' 
                      : unsyncedCount > 0 
                        ? `💾 Оффлайн (В очереди: ${unsyncedCount} опер.)` 
                        : '💾 Локально'}
              </span>
            </div>
          </div>

          {/* Navigation Tabs - horizontal scrolling on compact viewports */}
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none -mx-4 px-4 xl:mx-0 xl:px-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'hover:bg-slate-900 hover:text-white font-medium text-slate-400'
              }`}
            >
              <LayoutDashboard size={15} />
              <span>Дашборд</span>
            </button>

            {role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'transactions'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'hover:bg-slate-900 hover:text-white font-medium text-slate-400'
                }`}
              >
                <ArrowLeftRight size={15} />
                <span>Приход / Расход</span>
              </button>
            )}

            {role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('journal')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'journal'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'hover:bg-slate-900 hover:text-white font-medium text-slate-400'
                }`}
              >
                <FileClock size={15} />
                <span>Журнал</span>
              </button>
            )}

            {role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('returns')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'returns'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'hover:bg-slate-900 hover:text-white font-medium text-slate-400'
                }`}
              >
                <RotateCcw size={15} />
                <span>Возвраты</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('locations')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'locations'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'hover:bg-slate-900 hover:text-white font-medium text-slate-400'
              }`}
            >
              <Settings size={15} />
              <span>Камеры</span>
            </button>

            {role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('nomenclature')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'nomenclature'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'hover:bg-slate-900 hover:text-white font-medium text-slate-400'
                }`}
              >
                <Database size={15} />
                <span>Номенклатура</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gray-50 relative print:h-auto print:overflow-visible print:bg-white">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex items-center justify-center transition-all duration-300">
            <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xl border border-gray-100/80 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-8 h-8 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">Синхронизация...</p>
            </div>
          </div>
        )}
        <div className="max-w-[1500px] w-full mx-auto p-4 md:p-8 pb-24 md:pb-8 flex-grow flex flex-col print:p-0 print:pb-0">
          {/* Предупреждение об отключенном локальном сервере */}
          {!isLocalServerConnected && (
            <div className="mb-6 bg-rose-50/90 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 backdrop-blur-sm print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-900 leading-tight">Локальный сервер MeatSync не запущен!</h4>
                  <p className="text-xs text-rose-700 mt-0.5">Пожалуйста, запустите файл <b>Запуск MeatSync.bat</b> на компьютере. Вносимые сейчас изменения не будут сохранены!</p>
                </div>
              </div>
            </div>
          )}
          {/* Плашка Аудитора */}
          {dataWarning && (
            <div className="mb-6 bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 backdrop-blur-sm print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900 leading-tight">Проверка целостности данных</h4>
                  <p className="text-xs text-amber-700 mt-0.5">{dataWarning}</p>
                </div>
              </div>
              <button 
                onClick={() => runIntegrityFix(state)} 
                className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md border border-amber-600/10"
              >
                Починить автоматически
              </button>
            </div>
          )}
          {activeTab === 'dashboard' && (
             <Dashboard 
               batches={state.batches} 
               products={state.products} 
               locations={state.locations} 
             />
          )}

          {activeTab === 'nomenclature' && (
            <Nomenclature
              products={state.products}
              onAdd={addProduct}
              onUpdate={updateProduct}
              onDelete={deleteProduct}
              onClearAll={clearProducts}
              onImportMany={importManyProducts}
              buyers={state.buyers}
              onAddBuyer={addBuyer}
              onUpdateBuyer={updateBuyer}
              onDeleteBuyer={deleteBuyer}
            />
          )}

          {activeTab === 'transactions' && (
            <Transactions 
              products={state.products} 
              locations={state.locations} 
              batches={state.batches}
              buyers={state.buyers}
              onIncome={processIncome}
              onOutcome={processOutcome}
              onMove={moveBatch}
            />
          )}

          {activeTab === 'journal' && (
            <Journal
              transactions={state.transactions}
              products={state.products}
              locations={state.locations}
              buyers={state.buyers || []}
              onDeleteTransaction={role === 'ADMIN' ? deleteTransaction : undefined}
              onUpdateTransaction={role === 'ADMIN' ? updateTransaction : undefined}
            />
          )}

          {activeTab === 'returns' && (
            <Returns
              products={state.products}
              buyers={state.buyers || []}
              locations={state.locations}
              batches={state.batches}
              onSubmitReturn={processReturn}
              onDisposeReturn={processOutcome}
              onMoveReturn={moveBatch}
            />
          )}

          {activeTab === 'locations' && (
             <Locations 
               locations={state.locations}
               batches={state.batches}
               products={state.products}
             />
          )}
        </div>
      </main>
      <div className="print:hidden">
        <AiAssistantPanel state={state} />
      </div>
    </div>
  );
}
