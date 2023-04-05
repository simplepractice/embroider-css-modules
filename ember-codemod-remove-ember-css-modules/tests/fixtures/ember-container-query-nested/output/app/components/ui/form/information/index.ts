import Component from '@glimmer/component';

import styles from './index.css';

interface UiFormInformationSignature {
  // The arguments accepted by the component
  Args: {};
  // Any blocks yielded by the component
  Blocks: {
    default: [];
  };
  // The element to which `...attributes` is applied in the component template
  Element: null;
}

export default class UiFormInformationComponent extends Component<UiFormInformationSignature> {
  styles = styles;
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Ui::Form::Information': typeof UiFormInformationComponent;
    'ui/form/information': typeof UiFormInformationComponent;
  }
}
