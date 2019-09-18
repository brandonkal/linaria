import postcss, { AtRule, ChildNode } from 'postcss';

interface CollectResult {
  critical: string;
  other: string;
}

export default function collect(html: string, css: string): CollectResult {
  const animations = new Set();
  const other = postcss.root();
  const critical = postcss.root();
  const stylesheet = postcss.parse(css);
  const htmlClassesRegExp = extractClassesFromHtml(html);

  const isCritical = (rule: ChildNode) => {
    // Only check class names selectors
    if ('selector' in rule && rule.selector.startsWith('.')) {
      return Boolean(rule.selector.match(htmlClassesRegExp));
    }

    return true;
  };

  const handleAtRule = (rule: AtRule) => {
    let addedToCritical = false;

    rule.each(childRule => {
      if (isCritical(childRule)) {
        critical.append(rule.clone());
        addedToCritical = true;
      }
    });

    if (rule.name === 'keyframes') {
      return;
    }

    if (addedToCritical) {
      rule.remove();
    } else {
      other.append(rule);
    }
  };

  stylesheet.walkRules(rule => {
    if ('name' in rule.parent && rule.parent.name === 'keyframes') {
      return;
    }

    if (rule.parent.type === 'atrule') {
      handleAtRule(rule.parent);
      return;
    }

    if (isCritical(rule)) {
      critical.append(rule);
    } else {
      other.append(rule);
    }
  });

  critical.walkDecls(/animation/, decl => {
    animations.add(decl.value.split(' ')[0]);
  });

  stylesheet.walkAtRules('keyframes', rule => {
    if (animations.has(rule.params)) {
      critical.append(rule);
    }
  });

  return {
    critical: critical.toString(),
    other: other.toString(),
  };
}

const extractClassesFromHtml = (html: string): RegExp => {
  const htmlClasses: string[] = [];
  const regex = /\s+class="([^"]*)"/gm;
  let match = regex.exec(html);

  while (match !== null) {
    match[1].split(' ').forEach(className => htmlClasses.push(className));
    match = regex.exec(html);
  }

  return new RegExp(htmlClasses.join('|'), 'gm');
};
