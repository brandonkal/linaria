import Icon from './Icon';

type variant = string;

export const unused = () => fetch('something').then(() => {});

export default (variant?: variant, filled?: boolean) => {
  return Icon;
};
