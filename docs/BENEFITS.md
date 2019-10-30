# Why use Linaria

## Advantages over regular CSS

### 1. Selectors are scoped

Unlike regular CSS, Linaria will generate scoped class names so that there's no collision between multiple styles in a large application. It's automatic, unlike conventions such as BEM.

For example, consider the following:

```js
const title = css`
  font-size: 18px;
`;
```

The resulting CSS will look something like:

```css
.k4yi6fg {
  font-size: 18px;
}
```

Here the generated class name is unique and based on the hash of the path.

### 2. Styles are in same file as the component

With regular CSS, you'll need to create a separate file to write the CSS. This can be annoying when working with components because you'll need to do constant switching between the JS and CSS files while you're tweaking the styles. With Linaria, you can have the styles in the same file as rest of the JS.

You can also keep the styles in a separate JS file if you want, of course.

### 3. Refactor with confidence

You don't have to worry about breaking an unrelated component when changing and removing styles. Because Linaria's styles are like regular JavaScript variables, it is easy to track their usage and refactor.

### 4. No pre-processor needed\*

Linaria supports JavaScript expressions, which enables you to generate style rules inside a declaration programmatically with JavaScript. You can share constants and helper functions between your CSS and JavaScript freely.

For example, here we are using a `lighten` helper from a third-party library:

```js
import { lighten } from 'polished';

const PRIMARY_COLOR = '#de2d68';

const button = css`
  background-color: ${PRIMARY_COLOR};

  &:hover {
    background-color: ${lighten(0.2, PRIMARY_COLOR)};
  }
`;
```

\* Note that Linaria does require postcss and postcss-nested. PostCSS is probably already integrated into your build pipeline for features such as autoprefixer. Linaria integrates seamlessly in this pipeline, so you can use any postcss plugin or even SASS. However, the point to emphasize here is that by using JavaScript directly, you won't need all those plugins and extra syntax. This means less complexity.

If you have ever had to configure and learn LESS and SCSS syntax, you will appreciate the maintainablity of Linaria's solution. It has all the benefits of CSS-in-JS, while still compiling down to vanilla CSS files.

### 5. Automatic unused styles removal

Linaria automatically drops unused styles in a file unless it is exported. Linters like [ESLint](https://eslint.org/) can also warn you about when you have unused styles since they are just normal JS variables.

### 6. Integrates with PostCSS for automatic vendor prefixing

Pair Linaria with [PostCSS](https://postcss.org/) and autoprefixer, and your pipelint will automatically vendor prefix your CSS. You can worry less about supporting older browsers. You write modern CSS, and the computer will takes care of the rest.

### 7. Declarative dynamic styling with React

When using the `styled` helper, Linaria will generate dynamic CSS variables which automatically update when props change. When writing regular CSS, you'll have to manage it manually.

For example, here the `height` and `width` will automatically update based on the `size` prop of `Box`:

```js
const Box = styled.div`
  background-color: orange;
  height: ${props => props.size}px;
  width: ${props => props.size}px;
`;

<Box size={48}>
```

## Advantages over CSS preprocessors

### 1. No new syntax to learn

Linaria's syntax is just like regular CSS, plus ability to nest selectors for convenience. There's no new syntax for variables, mixins, or functions. It's just JavaScript!

### 2. Same advantages as regular CSS

Linaria has all the same advantages mentioned in "Advantages over regular CSS" even when you are using a CSS pre-processor.

## Advantages over inline styles

### 1. Full power of CSS

Unlike inline styles, you have the full power of CSS with Linaria, such as:

- Media queries
- Animation keyframes
- Hover, focus states etc.
- Pseudo-selectors

### 2. Performance

Class names perform much faster than inline styles.

## Advantages over other CSS-in-JS solutions

### 1. CSS is downloaded and parsed separately from JS

Since the styles are extracted to separate CSS files, the CSS and JavaScript can be downloaded and parsed by the browser in parallel which will improve the load time.

### 2. No extra parsing needed for CSS

Many CSS-in-JS libraries parse the CSS string using a custom parser on the client. This increases the bundle size (albeit slightly) due to the inclusion of the parser. In addition, the CSS cannot be parsed until the JavaScript code is parsed and executed, which can be noticable, especially on low-end devices and bigger JS bundles.

Linaria is unique in the sense that it doesn't need a runtime to work. Styles are parsed, evaluated, and generated at build time and no extra parsing is needed on the client.

### 3. No style duplication on Server Side Render

When you do SSR, the rendered CSS is downloaded in addition to the CSS you wrote in JS files. This is a waste of precious bandwidth and further increases the download and browser parsing size.

For component based CSS in JS libraries, rendering same the component with different props can lead to duplicating the same set of styles multiple times. It doesn't matter on the client side, but will increase the size of the rendered CSS when doing SSR. It may not matter for most cases, but when rendering a large list of elements with tiny differences in styles, this can quickly add up.

Linaria produces only one rule set per declaration, and any dynamic differences are taken care of using CSS variables. This means no duplication, which is great for reducing bundle size.

### 4. Catch errors early due to build-time evaluation

When you interpolate invalid values in Linaria (for example NaN in styles), you'll get a build-time error. In this way, you can avoid accidentally shipping bugs into production only to realize it later.

Paired with TypeScript and [csstyper](https://www.npmjs.com/package/eslint-plugin-csstyper), you can catch even more errors that stylelint alone will miss. For example:

```js
const Button = (props => styled.button`
  color: ${props.primary ? 'blue' : 'superwhite'};
`)({});
```

will throw an error.

### 5. Familiar CSS syntax

Unlike some CSS in JS libraries, Linaria lets you write normal CSS syntax, which means you can copy-paste styles from your browser's dev tools (or StackOverflow), and avoid unnecessary noise in the styles.

You can also use a pre-processor such as Sass if you prefer.

### 6. Works without JavaScript

If your website needs to work without JavaScript, or you generate the HTML in advance at build time, Linaria is a great fit for styling such websites.
