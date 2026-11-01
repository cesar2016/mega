-- Migration: agregar 'vendida' al enum estado_oferta
ALTER TYPE estado_oferta ADD VALUE IF NOT EXISTS 'vendida';
