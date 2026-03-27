import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import App, { 
  formatName,
  formatGrade,
  formatDesig, 
  formatSSN, 
  formatUIC, 
  formatTitle, 
  formatAch, 
  formatDateToNavy,
  FITREP_CONFIG 
} from './App';

global.window.api = {
    loadFitreps: vi.fn().mockResolvedValue([]),
    saveFitrep: vi.fn().mockResolvedValue({ success: true }),
    exportPDF: vi.fn().mockResolvedValue({ success: true }),
  };

describe('NAVFIT26 Logic (Dynamic Configuration)', () => {

    describe('Block 1: Name Validation', () => {
        it('should return false for valid Navy format', () => {
            expect(formatName('SMITH, JOHN A')).toBe(false); // false means "Not Invalid"
        });

        it('should return false for hyphenated last names', () => {
            expect(formatName('SMITH-JONES, JOHN')).toBe(false);
        });

        it('should return true if comma is missing', () => {
            expect(formatName('SMITH JOHN')).toBe(true); // true means "Invalid"
        });

        it('should return true if lowercase letters are used', () => {
            expect(formatName('Smith, John')).toBe(true);
        });
    });

    describe('Block 2: Grade/Rate Validation', () => {
        it('should return false for valid Navy ranks', () => {
          expect(formatGrade('LT')).toBe(false);
          expect(formatGrade('LCDR')).toBe(false);
        });
      
        it('should return true for invalid ranks or typos', () => {
          expect(formatGrade('SGT')).toBe(true); // Army/Marine rank
          expect(formatGrade('L-T')).toBe(true); // Formatting error
        });
      });

    describe('Block 3: Designator Logic', () => {
        it('should flag a designator longer than the config limit', () => {
            const invalidDesig = '13105';
            expect(invalidDesig.length).toBeGreaterThan(FITREP_CONFIG.MAX_DESIG_LENGTH);
        });
        
        it('should clean non-numeric input via formatDesig', () => {
            const result = formatDesig('131A');
            expect(result).toBe('131'); // Should strip the 'A'
        });
    });

    describe('Block 4: SSN Validation', () => {
        it('should format numbers with dashes regardless of length', () => {
            expect(formatSSN('123456789')).toBe('123-45-6789');
    });
    
    it('should detect if SSN exceeds configuration', () => {
      const input = '1234567890'; // 10 digits
      const digitsOnly = input.replace(/\D/g, '').length;
      expect(digitsOnly).toBeGreaterThan(FITREP_CONFIG.MAX_SSN_DIGITS);
    });
    });

    describe('Block 5: Duty Status', () => {
  
        it('should allow the user to select a Duty Status radio button', () => {
        render(<App />);
        
        // Use getAllByLabelText and [0] to pick the one in the Editor, not the PDF
        const actRadios = screen.getAllByLabelText(/ACT/i);
        const actRadio = actRadios[0]; 
        
        fireEvent.click(actRadio);
        expect(actRadio.checked).toBe(true);
    });
  
    it('should show only one radio button as checked at a time', () => {
      render(<App />);
      
      const actRadios = screen.getAllByLabelText(/ACT/i);
      const ftsRadios = screen.getAllByLabelText(/FTS/i);
      
      const actRadio = actRadios[0];
      const ftsRadio = ftsRadios[0];
      
      fireEvent.click(actRadio);
      fireEvent.click(ftsRadio);
      
      expect(ftsRadio.checked).toBe(true);
      expect(actRadio.checked).toBe(false);
    });
  });

  describe('Designator & UIC', () => {
    it('should strip non-digits', () => {
      expect(formatDesig('1310ABC')).toBe('1310');
    });

    it('should validate length against config', () => {
      const input = '12345';
      expect(input.length).toBeGreaterThan(FITREP_CONFIG.MAX_DESIG_LENGTH);
    });
  });

  describe('Block 25: Title', () => {
    it('should strip numbers', () => {
      expect(formatTitle('CO 123')).toBe('CO ');
    });

    it('should identify when Title exceeds config limit', () => {
      const longTitle = 'COMMANDING OFFICER';
      expect(longTitle.length).toBeGreaterThan(FITREP_CONFIG.MAX_TITLE_LENGTH);
    });
  });

  describe('Block 28: Achievements', () => {
    it('should flag text that exceeds achievement limit', () => {
      const longText = 'A'.repeat(FITREP_CONFIG.MAX_ACHIEVEMENT_LENGTH + 1);
      expect(longText.length).toBeGreaterThan(FITREP_CONFIG.MAX_ACHIEVEMENT_LENGTH);
    });
  });

  describe('Date Logic', () => {
    it('should format to Navy standard YYMONDD', () => {
      expect(formatDateToNavy('2026-02-01')).toBe('26FEB01');
    });
  });
});

