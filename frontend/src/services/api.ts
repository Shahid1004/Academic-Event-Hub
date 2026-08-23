import axios from 'axios';
import type { DashboardSummary } from '../types';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

export async function getDashboardSummary(academicYear?: string, department = 'ALL') {
  const response = await axios.get<{ success: boolean; data: DashboardSummary }>(
    `${apiUrl}/api/dashboard/summary`,
    {
      params: { academicYear: academicYear || undefined, department },
      headers: { Authorization: `Bearer ${getToken()}` }
    }
  );
  return response.data.data;
}
