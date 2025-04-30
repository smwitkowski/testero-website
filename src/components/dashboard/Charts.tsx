import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ProgressChartProps {
  data: { date: string; score: number }[];
  config: {
    score: {
      label: string;
      color: string;
    };
  };
}

export const ProgressChart: React.FC<ProgressChartProps> = ({ data, config }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar
          dataKey="score"
          fill={config.score.color}
          name={config.score.label}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

interface SectionScoreChartProps {
  data: { section: string; score: number }[];
}

export const SectionScoreChart: React.FC<SectionScoreChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="section" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="score" fill="#8884d8" name="Score" />
      </BarChart>
    </ResponsiveContainer>
  );
};