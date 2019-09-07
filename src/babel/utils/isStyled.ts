import { isValidElementType } from 'react-is';
import { Styled } from '../types';

export default function isStyled(value: any): value is Styled {
  return isValidElementType(value) && (value as any).__linaria;
}
