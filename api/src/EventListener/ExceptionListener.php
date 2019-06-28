<?php
namespace Crypter\EventListener;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\GetResponseForExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

use Doctrine\DBAL\Exception\UniqueConstraintViolationException;

use \Firebase\JWT\UnexpectedValueException;
use \Firebase\JWT\SignatureInvalidException;

class ExceptionListener
{
    public function onKernelException(GetResponseForExceptionEvent $event)
    {
        $exception = $event->getException();

        // throw $exception;

        $response = new Response("'Internal Server Error': {$exception->getMessage()}", Response::HTTP_INTERNAL_SERVER_ERROR);

        if ($exception instanceof UniqueConstraintViolationException) {
            $response = new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        if ($exception instanceof UnexpectedValueException or $exception instanceof SignatureInvalidException) {
            $response = Response('Unauthorized', Response::HTTP_UNAUTHORIZED, ['WWW-Authenticate' => 'Bearer']);
        }

        $event->setResponse($response);
    }
}