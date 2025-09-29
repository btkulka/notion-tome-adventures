"use client"

import React from "react"
import { AbilityScores } from "@/types/notion-dtos"

interface AbilityScoresRadialChartProps {
  scores: AbilityScores;
  className?: string;
}

export function AbilityScoresRadialChart({ scores, className }: AbilityScoresRadialChartProps) {
  const abilities = [
    { key: 'str', name: 'Strength', abbrev: 'STR', value: scores.str, color: '#ef4444' },
    { key: 'dex', name: 'Dexterity', abbrev: 'DEX', value: scores.dex, color: '#22c55e' },
    { key: 'con', name: 'Constitution', abbrev: 'CON', value: scores.con, color: '#f59e0b' },
    { key: 'int', name: 'Intelligence', abbrev: 'INT', value: scores.int, color: '#3b82f6' },
    { key: 'wis', name: 'Wisdom', abbrev: 'WIS', value: scores.wis, color: '#8b5cf6' },
    { key: 'char', name: 'Charisma', abbrev: 'CHA', value: scores.char, color: '#ec4899' }
  ];

  const getModifier = (score: number) => Math.floor((score - 10) / 2);
  
  // Radar chart parameters
  const centerX = 120;
  const centerY = 120;
  const maxRadius = 80;
  const maxScore = 20; // D&D ability scores typically max at 20
  
  // Calculate points for radar chart polygon
  const radarPoints = abilities.map((ability, index) => {
    const angle = (index * 60 - 90) * (Math.PI / 180); // Start from top (-90 degrees)
    const normalizedValue = Math.min(ability.value / maxScore, 1); // Normalize to 0-1
    const radius = normalizedValue * maxRadius;
    
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      angle,
      ability
    };
  });

  // Create the radar polygon path
  const radarPath = radarPoints.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ') + ' Z';

  // Create background grid rings
  const gridRings = [0.2, 0.4, 0.6, 0.8, 1.0].map(factor => {
    const ringPoints = abilities.map((_, index) => {
      const angle = (index * 60 - 90) * (Math.PI / 180);
      const radius = factor * maxRadius;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });
    
    const ringPath = ringPoints.map((point, index) => 
      `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    ).join(' ') + ' Z';
    
    return ringPath;
  });

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Radar Chart */}
      <div className="flex justify-center">
        <svg width="240" height="240" className="drop-shadow-lg">
          {/* Background grid rings */}
          {gridRings.map((ringPath, index) => (
            <path
              key={`ring-${index}`}
              d={ringPath}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="1"
              opacity={0.3}
            />
          ))}
          
          {/* Spokes/axes from center to each ability */}
          {abilities.map((ability, index) => {
            const angle = (index * 60 - 90) * (Math.PI / 180);
            const endX = centerX + maxRadius * Math.cos(angle);
            const endY = centerY + maxRadius * Math.sin(angle);
            
            return (
              <line
                key={`spoke-${ability.key}`}
                x1={centerX}
                y1={centerY}
                x2={endX}
                y2={endY}
                stroke="hsl(var(--border))"
                strokeWidth="1"
                opacity="0.4"
              />
            );
          })}
          
          {/* Main radar polygon */}
          <path
            d={radarPath}
            fill="hsl(var(--primary))"
            fillOpacity="0.2"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
          
          {/* Data points at each vertex */}
          {radarPoints.map((point) => (
            <g key={`point-${point.ability.key}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill={point.ability.color}
                stroke="white"
                strokeWidth="2"
                style={{
                  filter: `drop-shadow(0 0 4px ${point.ability.color}40)`
                }}
              />
            </g>
          ))}
          
          {/* Ability labels around the chart */}
          {abilities.map((ability, index) => {
            const angle = (index * 60 - 90) * (Math.PI / 180);
            const labelRadius = maxRadius + 20;
            const labelX = centerX + labelRadius * Math.cos(angle);
            const labelY = centerY + labelRadius * Math.sin(angle);
            const modifier = getModifier(ability.value);
            
            return (
              <g key={`label-${ability.key}`}>
                {/* Ability abbreviation */}
                <text
                  x={labelX}
                  y={labelY - 5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground font-bold text-sm"
                  style={{ fill: ability.color }}
                >
                  {ability.abbrev}
                </text>
                {/* Score value */}
                <text
                  x={labelX}
                  y={labelY + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground font-semibold text-xs"
                >
                  {ability.value}
                </text>
                {/* Modifier */}
                <text
                  x={labelX}
                  y={labelY + 20}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-muted-foreground text-xs"
                >
                  {modifier >= 0 ? '+' : ''}{modifier}
                </text>
              </g>
            );
          })}
          
          {/* Center point */}
          <circle
            cx={centerX}
            cy={centerY}
            r="3"
            fill="hsl(var(--primary))"
            opacity="0.8"
          />
        </svg>
      </div>
    </div>
  );
}
