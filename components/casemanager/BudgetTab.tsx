import React, { useState } from 'react';
import { Case, BudgetEntry } from '../../types';
import { Plus, Trash2 } from 'lucide-react';
import { handleSuccess } from '../../utils/errorHandler';

interface BudgetTabProps {
  activeCase: Case | null;
  updateCase: (id: string, data: Partial<Case>) => Promise<void>;
}

export const BudgetTab: React.FC<BudgetTabProps> = ({ activeCase, updateCase }) => {
  const [showAddTime, setShowAddTime] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newTime, setNewTime] = useState<Partial<BudgetEntry>>({ type: 'time' });
  const [newExpense, setNewExpense] = useState<Partial<BudgetEntry>>({ type: 'expense' });

  if (!activeCase) {
    return <div className="text-slate-400">Select a case to view</div>;
  }

  const entries = activeCase.budgetEntries || [];
  const timeEntries = entries.filter(e => e.type === 'time');
  const expenseEntries = entries.filter(e => e.type === 'expense');

  const totalHours = timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const totalTimeAmount = timeEntries.reduce((sum, e) => sum + ((e.hours || 0) * (e.rate || 0)), 0);
  const totalExpenses = expenseEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
  const total = totalTimeAmount + totalExpenses;

  const handleAddTime = async () => {
    if (!newTime.description || !newTime.date || !newTime.hours) {
      handleSuccess('Fill in description, date, and hours');
      return;
    }
    const entry: BudgetEntry = {
      id: crypto.randomUUID(),
      caseId: activeCase.id,
      type: 'time',
      description: newTime.description,
      date: newTime.date,
      hours: newTime.hours,
      rate: newTime.rate || 250,
      amount: (newTime.hours || 0) * (newTime.rate || 250),
    };
    const updated = [...entries, entry];
    await updateCase(activeCase.id, { budgetEntries: updated });
    setNewTime({ type: 'time' });
    setShowAddTime(false);
    handleSuccess('Time entry added');
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.date || !newExpense.amount) {
      handleSuccess('Fill in description, date, and amount');
      return;
    }
    const entry: BudgetEntry = {
      id: crypto.randomUUID(),
      caseId: activeCase.id,
      type: 'expense',
      description: newExpense.description,
      date: newExpense.date,
      amount: newExpense.amount,
      category: newExpense.category,
    };
    const updated = [...entries, entry];
    await updateCase(activeCase.id, { budgetEntries: updated });
    setNewExpense({ type: 'expense' });
    setShowAddExpense(false);
    handleSuccess('Expense added');
  };

  const handleDelete = async (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    await updateCase(activeCase.id, { budgetEntries: updated });
    handleSuccess('Entry deleted');
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Billed Hours</p>
          <p className="text-gold-500 text-2xl font-bold">{totalHours}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Time Amount</p>
          <p className="text-gold-500 text-2xl font-bold">${totalTimeAmount.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Expenses</p>
          <p className="text-gold-500 text-2xl font-bold">${totalExpenses.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Total</p>
          <p className="text-gold-500 text-2xl font-bold">${total.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
        </div>
      </div>

      {/* Time Entries */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-white">Time Entries</h3>
          <button
            onClick={() => setShowAddTime(true)}
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-3 py-1 rounded text-sm"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-3 py-2 text-left text-slate-300">Date</th>
                <th className="px-3 py-2 text-left text-slate-300">Description</th>
                <th className="px-3 py-2 text-right text-slate-300">Hours</th>
                <th className="px-3 py-2 text-right text-slate-300">Rate</th>
                <th className="px-3 py-2 text-right text-slate-300">Total</th>
                <th className="px-3 py-2 text-right text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {timeEntries.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-3 text-center text-slate-400">No time entries</td></tr>
              ) : (
                timeEntries.map(e => (
                  <tr key={e.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="px-3 py-2 text-white">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-slate-300">{e.description}</td>
                    <td className="px-3 py-2 text-right text-white">{e.hours}</td>
                    <td className="px-3 py-2 text-right text-gold-500">${e.rate}</td>
                    <td className="px-3 py-2 text-right text-gold-500 font-semibold">${((e.hours || 0) * (e.rate || 0)).toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => handleDelete(e.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showAddTime && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
            <input
              type="date"
              value={newTime.date || ''}
              onChange={e => setNewTime({ ...newTime, date: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <input
              type="text"
              placeholder="Description"
              value={newTime.description || ''}
              onChange={e => setNewTime({ ...newTime, description: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Hours"
                value={newTime.hours || ''}
                onChange={e => setNewTime({ ...newTime, hours: parseFloat(e.target.value) })}
                className="bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              />
              <input
                type="number"
                placeholder="Rate ($/hr)"
                value={newTime.rate || ''}
                onChange={e => setNewTime({ ...newTime, rate: parseFloat(e.target.value) })}
                className="bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddTime}
                className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-3 py-2 rounded text-sm"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddTime(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-3 py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expense Entries */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-white">Expenses</h3>
          <button
            onClick={() => setShowAddExpense(true)}
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-3 py-1 rounded text-sm"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-3 py-2 text-left text-slate-300">Date</th>
                <th className="px-3 py-2 text-left text-slate-300">Description</th>
                <th className="px-3 py-2 text-left text-slate-300">Category</th>
                <th className="px-3 py-2 text-right text-slate-300">Amount</th>
                <th className="px-3 py-2 text-right text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {expenseEntries.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-3 text-center text-slate-400">No expenses</td></tr>
              ) : (
                expenseEntries.map(e => (
                  <tr key={e.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="px-3 py-2 text-white">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-slate-300">{e.description}</td>
                    <td className="px-3 py-2 text-slate-300 text-xs">{e.category || '—'}</td>
                    <td className="px-3 py-2 text-right text-gold-500 font-semibold">${e.amount?.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => handleDelete(e.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showAddExpense && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
            <input
              type="date"
              value={newExpense.date || ''}
              onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <input
              type="text"
              placeholder="Description"
              value={newExpense.description || ''}
              onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <input
              type="number"
              placeholder="Amount"
              value={newExpense.amount || ''}
              onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <input
              type="text"
              placeholder="Category (optional)"
              value={newExpense.category || ''}
              onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddExpense}
                className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-3 py-2 rounded text-sm"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddExpense(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-3 py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
