/**
 * External dependencies
 */
import { __ } from '@wordpress/i18n';
import { SquarePaymentForm } from 'react-square-payment-form';

/**
 * Internal dependencies
 */
import { CheckoutHandler } from './checkout-handler';
import { usePaymentForm } from './use-payment-form';
import { getSquareServerData } from '../square-utils';
import { ComponentCardFields } from './component-card-fields';

/**
 * @typedef {import('@woocommerce/type-defs/registered-payment-method-props').RegisteredPaymentMethodProps} RegisteredPaymentMethodProps
 */

/**
 * Square's credit card component
 *
 * @param {RegisteredPaymentMethodProps} props Incoming props
 */
export const ComponentCreditCard = ( {
	billing,
	eventRegistration,
	emitResponse,
	shouldSavePayment,
} ) => {
	const form = usePaymentForm( billing, shouldSavePayment );

	return (
		<SquarePaymentForm
			formId={ 'square-credit-card' }
			sandbox={ getSquareServerData().isSandbox }
			applicationId={ getSquareServerData().applicationId }
			locationId={ getSquareServerData().locationId }
			inputStyles={ getSquareServerData().inputStyles }
			placeholderCreditCard={ '•••• •••• •••• ••••' }
			placeholderExpiration={ __( 'MM / YY', 'woocommerce-square' ) }
			placeholderCVV={ __( 'CSC', 'woocommerce-square' ) }
			postalCode={ form.getPostalCode }
			cardNonceResponseReceived={ form.cardNonceResponseReceived }
			inputEventReceived={ form.handleInputReceived }
			paymentFormLoaded={ () => form.setLoaded( true ) }
		>
			<ComponentCardFields cardType={ form.cardType } />
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
