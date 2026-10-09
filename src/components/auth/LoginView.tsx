import React, { useState, useEffect } from 'react';
import { authService } from '../../services/auth.service';
import { Lock } from 'lucide-react';

export const LoginView: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setPin(prev => {
          if (prev.length < 8) return prev + e.key;
          return prev;
        });
        setError('');
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        // We can't directly call handleLogin here because it relies on the state closure.
        // We'll use a hack or just trigger a submit button, or we can just rely on the effect dependencies.
        // Actually, we can use a hidden button or just keep it simple.
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNumberClick = (num: string) => {
    if (pin.length < 8) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (!pin) return;
    
    try {
      await authService.loginWithPin(pin);
      // Success is handled by state change in authService
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || "Code PIN incorrect.");
      setPin('');
    }
  };

  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleLogin();
      }
    };
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [pin]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-sans">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <div className="bg-blue-100 p-4 rounded-full inline-block mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Aquadro POS</h1>
          <p className="text-gray-500 mt-2">Veuillez entrer votre code PIN pour vous connecter</p>
        </div>

        <div className="mb-6 text-center">
          <div className="flex justify-center gap-2 mb-2">
            {[...Array(4)].map((_, i) => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-blue-600' : 'bg-gray-200'} transition-colors duration-200`}
              />
            ))}
          </div>
          {error && <p className="text-red-500 text-sm font-medium mt-2">{error}</p>}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              className="h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-lg text-xl font-semibold text-gray-800 transition-colors border border-gray-200"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="h-14 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-lg text-xl font-semibold text-red-600 transition-colors border border-red-100"
          >
            ⌫
          </button>
          <button
            onClick={() => handleNumberClick('0')}
            className="h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-lg text-xl font-semibold text-gray-800 transition-colors border border-gray-200"
          >
            0
          </button>
          <button
            onClick={handleLogin}
            className="h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg text-xl font-semibold text-white transition-colors shadow-sm"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
