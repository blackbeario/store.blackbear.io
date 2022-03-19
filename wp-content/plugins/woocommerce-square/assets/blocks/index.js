/**
 * External dependencies
 */
import { registerPaymentMethod } from '@woocommerce/blocks-registry';

/**
 * Internal dependencies
 */
import squareCreditCardMethod from './credit-card';

// Register Square Credit Card.
registerPaymentMethod( squareCreditCardMethod );
