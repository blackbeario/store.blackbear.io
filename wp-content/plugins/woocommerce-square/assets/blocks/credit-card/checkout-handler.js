/**
 * External dependencies
 */
import { useContext } from '@wordpress/element';
import { Context } from 'react-square-payment-form';

/**
 * Internal dependencies
 */
import { usePaymentProcessing } from './use-payment-processing';
import { useAfterProcessingCheckout } from './use-after-processing-checkout';

/**
 * @typedef {import('../square-utils/type-defs').SquarePaymentFormHandler} SquarePaymentFormHandler
 * @typedef {import('@woocommerce/type-defs/registered-payment-method-props').EventRegistrationProps} EventRegistrationProps
 * @typedef {import('@woocommerce/type-defs/registered-payment-method-props').BillingDataProps} BillingDataProps
 * @typedef {import('@woocommerce/type-defs/registered-payment-method-props').EmitResponseProps} EmitResponseProps
 */

/**
 * Handles checkout processing
 *
 * @param {Object}                   props                     Incoming props
 * @param {SquarePaymentFormHandler} props.checkoutFormHandler Checkout form handler
 * @param {EventRegistrationProps}   props.eventRegistration   Event registration functions.
 * @param {EmitResponseProps}        props.emitResponse        Helpers for observer response objects.
 */
export const CheckoutHandler = ( {
	checkoutFormHandler,
	eventRegistration,
	emitResponse,
} ) => {
	const square = useContext( Context );

	const {
		onPaymentProcessing,
		onCheckoutAfterProcessingWithError,
		onCheckoutAfterProcessingWithSuccess,
	} = eventRegistration;

	const {
		getPaymentMethodData,
		createNonce,
		verifyBuyer,
	} = checkoutFormHandler;

	usePaymentProcessing(
		onPaymentProcessing,
		emitResponse,
		square,
		getPaymentMethodData,
		createNonce,
		verifyBuyer
	);

	useAfterProcessingCheckout(
		onCheckoutAfterProcessingWithError,
		onCheckoutAfterProcessingWithSuccess,
		emitResponse
	);

	return null;
};
