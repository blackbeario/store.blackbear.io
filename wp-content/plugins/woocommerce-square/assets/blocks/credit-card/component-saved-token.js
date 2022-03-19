/**
 * External dependencies
 */
import { SquarePaymentForm } from 'react-square-payment-form';

/**
 * Internal dependencies
 */
import { CheckoutHandler } from './checkout-handler';
import { usePaymentForm } from './use-payment-form';
import { getSquareServerData } from '../square-utils';

/**
 * @typedef {import('@woocommerce/type-defs/registered-payment-method-props').RegisteredPaymentMethodProps} RegisteredPaymentMethodProps
 */

/**
 * Square's saved credit card component
 *
 * @param {RegisteredPaymentMethodProps} props Incoming props
 */
export const ComponentSavedToken = ( {
	billing,
	eventRegistration,
	emitResponse,
	token,
} ) => {
	const form = usePaymentForm( billing, false, token );

	return (
		<SquarePaymentForm
			formId={ 'square-credit-card-saved-card' }
			sandbox={ getSquareServerData().isSandbox }
			applicationId={ getSquareServerData().applicationId }
			locationId={ getSquareServerData().locationId }
			paymentFormLoaded={ () => form.setLoaded( true ) }
		>
			{ form.isLoaded && (
				<CheckoutHandler
					checkoutFormHandler={ form }
					eventRegistration={ eventRegistration }
					emitResponse={ emitResponse }
				/>
			) }
		</SquarePaymentForm>
	);
};
